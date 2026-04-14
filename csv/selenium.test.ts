import { Builder, By, until, Key, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Configuration ───────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173/v2/editor';
const CSV_PATH = path.join(__dirname, 'praxly.test.csv');
const TEST_FILTER = process.env.TEST_FILTER ?? '';

const TIMEOUT_MS = 15_000;   // max wait for any element
const RUN_SETTLE_MS = 500;    // pause after Run before reading output
const INPUT_DELAY_MS = 250;      // pause between stdin lines

// ─── ANSI colour helpers ─────────────────────────────────────────────────────

const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
} as const;

const clr = (color: string, text: string) => `${color}${text}${C.reset}`;

// ─── Visual progress bar ─────────────────────────────────────────────────────

const BAR_WIDTH = 40;

function renderProgressBar(passed: number, failed: number, total: number, current: number): void {
    const done = passed + failed;
    const pct = total === 0 ? 0 : done / total;
    const filled = Math.round(BAR_WIDTH * pct);
    const empty = BAR_WIDTH - filled;

    const bar =
        clr(C.green, '█'.repeat(Math.max(0, filled - (failed > 0 ? 1 : 0)))) +
        (failed > 0 ? clr(C.red, '█') : '') +
        clr(C.dim, '░'.repeat(empty));

    const stats =
        clr(C.green, `${passed}✓`) + ' ' +
        clr(C.red, `${failed}✗`) + ' ' +
        clr(C.dim, `${done}/${total}`);

    process.stdout.write(`\r  [${bar}] ${stats}  `);
}

// ─── Normalise output for comparison ─────────────────────────────────────────

function normalise(s: string = ''): string {
    return s
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(l => l.trimEnd())
        .join('\n')
        .trim();
}

// ─── Build a WebDriver instance ───────────────────────────────────────────────

async function buildDriver(headless: boolean): Promise<WebDriver> {
    const opts = new chrome.Options()
        .addArguments('--no-sandbox')
        .addArguments('--disable-dev-shm-usage')
        .addArguments('--window-size=1600,900');

    if (headless) {
        opts.addArguments('--headless=new');
    }

    return new Builder()
        .forBrowser('chrome')
        .setChromeOptions(opts)
        .build();
}

// ─── Editor interaction helpers ───────────────────────────────────────────────

/**
 * Clear the CodeMirror editor completely and replace its content.
 */
async function setEditorCode(driver: WebDriver, code: string): Promise<void> {
    const cmContent = await driver.wait(
        until.elementLocated(By.css('.cm-content')),
        TIMEOUT_MS
    );
    await cmContent.click();

    // Select-all and delete
    const selectAll = process.platform === 'darwin'
        ? Key.chord(Key.COMMAND, 'a')
        : Key.chord(Key.CONTROL, 'a');

    await cmContent.sendKeys(selectAll);
    await driver.sleep(100);
    await cmContent.sendKeys(Key.DELETE);
    await driver.sleep(150);

    // Type the new source code
    await cmContent.sendKeys(code);
    await driver.sleep(100);
}

/**
 * Click the "Run Code" button in the header toolbar.
 */
async function clickRun(driver: WebDriver): Promise<void> {
    const runBtn = await driver.findElement(
        By.xpath("//button[contains(., 'Run Code')]")
    );
    await runBtn.click();
}

/**
 * Supply stdin lines one-by-one as the program requests them.
 * Praxly shows an <input> element each time input() is called.
 * This gracefully handles the case where stdin isn't implemented yet.
 */
async function supplyInputs(driver: WebDriver, lines: string[]): Promise<void> {
    if (lines.length === 0) {
        return;
    }

    for (const line of lines) {
        try {
            // Wait for the stdin prompt to appear
            // Increased timeout to account for slower interpreters or network
            const inputEl = await driver.wait(
                until.elementLocated(
                    By.css(
                        'input[data-testid="stdin-input"], ' +
                        'input.stdin-input, ' +
                        'input[placeholder*="input"], ' +
                        'input[placeholder*="Enter"], ' +
                        'input[type="text"]'
                    )
                ),
                5000
            );
            await driver.wait(until.elementIsVisible(inputEl), TIMEOUT_MS);

            // Clear can trigger onChange, but sometimes React needs a discrete event
            await inputEl.clear();
            await inputEl.sendKeys(line);

            // Click the Submit button to ensure the input is processed
            // The button is a sibling or near the input in the DOM
            try {
                const submitBtn = await driver.findElement(
                    By.xpath("//button[contains(., 'Submit')]")
                );
                await submitBtn.click();
            } catch (e) {
                // If submit button not found, try Enter key (fallback)
                await inputEl.sendKeys(Key.RETURN);
            }

            // Important: Wait for the input element to disappear or be replaced
            // This ensures we don't try to enter the next input into the OLD field
            try {
                await driver.wait(until.stalenessOf(inputEl), 5000);
            } catch (e) {
                // Ignore if it doesn't disappear (maybe it persists? likely not in Praxly)
            }

            await driver.sleep(INPUT_DELAY_MS);
        } catch (e: any) {
            // If no more input prompts appear the program has finished - that's fine
            // This is expected when stdin isn't implemented or the program doesn't need input
            break;
        }
    }
}

/**
 * Read and return the full text of the output / console panel.
 */
async function readOutputPanel(driver: WebDriver): Promise<string> {
    try {
        // Find the output panel by testid
        const panel = await driver.findElement(By.css('[data-testid="output-panel"]'));

        // Find all output line divs within the panel
        const outputContainer = await panel.findElement(
            By.css('div.flex-1.overflow-auto.bg-slate-950')
        );

        // Get all the line divs (each output line is in a separate div)
        const lineDivs = await outputContainer.findElements(
            By.css('div.flex.gap-4')
        );

        if (lineDivs.length === 0) {
            // No output yet - check if there's the "Run code to see..." placeholder
            const text = await outputContainer.getText();
            return '';
        }

        // Extract just the output text (skip the line numbers)
        const lines: string[] = [];
        for (const lineDiv of lineDivs) {
            const spans = await lineDiv.findElements(By.css('span'));
            if (spans.length >= 2) {
                // The second span contains the actual output
                const outputText = await spans[1].getText();
                lines.push(outputText);
            }
        }

        return lines.join('\n');
    } catch (e) {
        console.error('Error reading output panel:', e);
        return '';
    }
}

/**
 * Return any error text shown in the error/console panel.
 */
async function readErrorText(driver: WebDriver): Promise<string> {
    try {
        // Find the output panel which contains error info in the header
        const panel = await driver.findElement(By.css('[data-testid="output-panel"]'));

        // Look for error message in the header (where AlertCircle icon appears)
        const header = await panel.findElement(By.css('div.h-8'));
        const headerText = await header.getText();

        // The error text appears after the "CONSOLE OUTPUT" label
        if (headerText.includes('Error') || headerText.includes('error')) {
            return headerText;
        }

        return '';
    } catch (_) {
        // If we can't find an error element, there's probably no error
        return '';
    }
}

/**
 * Clear the output panel so old content doesn't bleed into the next test.
 * We navigate to the editor URL which resets all React state.
 */
async function resetEditorState(driver: WebDriver): Promise<void> {
    await driver.get(BASE_URL);
    await driver.wait(until.elementLocated(By.css('.cm-content')), TIMEOUT_MS);
    // Wait a bit longer for React to settle and clear any old state
    await driver.sleep(500);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestRow {
    'Test Name': string;
    'Program Code': string;
    'User Input': string;
    'Expected Output': string;
    'Expected Error': string;
}

type TestStatus = 'PASS' | 'FAIL' | 'ERROR';

interface TestResult {
    name: string;
    status: TestStatus;
    message: string;
    actualOut: string;
    actualErr: string;
    expectedOut: string;
    expectedErr: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
    // ── Load CSV ──────────────────────────────────────────────────────────────
    const csvContent = readFileSync(CSV_PATH, 'utf-8');
    const allRecords = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
    }) as TestRow[];

    const tests = TEST_FILTER
        ? allRecords.filter(r => r['Test Name'].includes(TEST_FILTER))
        : allRecords;

    // ── Header ────────────────────────────────────────────────────────────────
    console.log('');
    console.log(clr(C.bold + C.cyan, '  ╔══════════════════════════════════════╗'));
    console.log(clr(C.bold + C.cyan, '  ║       PRAXLY  TEST  RUNNER           ║'));
    console.log(clr(C.bold + C.cyan, '  ╚══════════════════════════════════════╝'));
    console.log('');
    console.log(`  ${clr(C.dim, 'URL    :')} ${BASE_URL}`);
    console.log(`  ${clr(C.dim, 'CSV    :')} ${CSV_PATH}`);
    console.log(`  ${clr(C.dim, 'Tests  :')} ${tests.length} / ${allRecords.length}` +
        (TEST_FILTER ? `  ${clr(C.yellow, `(filter: "${TEST_FILTER}")`)}` : ''));
    console.log('');

    // ── Build headless driver ─────────────────────────────────────────────────
    let driver = await buildDriver(true);
    let passed = 0;
    let failed = 0;
    let errored = 0;
    const results: TestResult[] = [];
    let failedTest: TestResult | null = null;

    try {
        await driver.get(BASE_URL);
        await driver.wait(until.elementLocated(By.css('.cm-content')), TIMEOUT_MS);
        await driver.sleep(500);  // Let CodeMirror initialize

        // ── Test loop ───────────────────────────────────────────────────────────
        for (const [idx, test] of tests.entries()) {
            const name = test['Test Name']?.trim() || `test_${idx}`;
            const code = test['Program Code']?.trim() || '';
            const rawInput = test['User Input']?.trim() || '';
            const expectedOut = test['Expected Output']?.trim() || '';
            const expectedErr = test['Expected Error']?.trim() || '';
            const inputLines = rawInput ? rawInput.split('\n').map(l => l.trim()) : [];

            // Render live progress BEFORE running this test
            renderProgressBar(passed, failed, tests.length, idx);

            let status: TestStatus = 'PASS';
            let message = '';
            let actualOut = '';
            let actualErr = '';

            try {
                // Reset state (navigate + wait)
                await resetEditorState(driver);

                // Type the program code into CodeMirror
                await setEditorCode(driver, code);

                // Run the program
                await clickRun(driver);

                // Feed stdin
                if (inputLines.length > 0) {
                    await supplyInputs(driver, inputLines);
                }

                // Wait for output to settle
                await driver.sleep(RUN_SETTLE_MS);

                // Read results
                actualOut = normalise(await readOutputPanel(driver));
                actualErr = normalise(await readErrorText(driver));

                // Compare
                const normExpOut = normalise(expectedOut);
                const normExpErr = normalise(expectedErr);

                if (normExpErr) {
                    // This test expects a runtime/compile error
                    const combinedActual = actualErr || actualOut;
                    if (!combinedActual.includes(normExpErr)) {
                        status = 'FAIL';
                        message = `Expected error:\n    ${normExpErr}\n  Got:\n    ${combinedActual || '(empty)'}`;
                    }
                } else if (normExpOut) {
                    if (actualOut !== normExpOut) {
                        status = 'FAIL';
                        message = `Expected output:\n    ${normExpOut}\n  Got:\n    ${actualOut || '(empty)'}`;
                    }
                } else if (actualErr) {
                    status = 'FAIL';
                    message = `Unexpected error: ${actualErr}`;
                }

            } catch (e: any) {
                status = 'ERROR';
                message = e.message ?? String(e);
                errored++;
            }

            if (status === 'PASS') passed++;
            else failed++;

            const result: TestResult = {
                name, status, message, actualOut, actualErr, expectedOut, expectedErr,
            };
            results.push(result);

            // ── Print the individual test row ──────────────────────────────────────
            const icon = status === 'PASS' ? clr(C.green, '✓')
                : status === 'FAIL' ? clr(C.red, '✗')
                    : clr(C.yellow, '⚠');
            const label = status === 'PASS' ? clr(C.green, 'PASS')
                : status === 'FAIL' ? clr(C.red, 'FAIL')
                    : clr(C.yellow, 'ERROR');
            const num = clr(C.dim, `[${String(idx + 1).padStart(3)}]`);

            // Overwrite the progress bar line, then print the result on a new line
            process.stdout.write('\r');
            console.log(`  ${num} ${icon} ${label}  ${name}`);

            if (status !== 'PASS') {
                failedTest = result;
                // Print the diff
                console.log('');
                message.split('\n').forEach(l => console.log(`        ${clr(C.dim, l)}`));
                console.log('');

                // ── FAIL FAST: stop headless, re-open visually ─────────────────────
                console.log(clr(C.bold + C.red, '  ✖  Test failed — stopping suite and re-opening browser...'));
                console.log('');
                break;
            }
        }

    } finally {
        await driver.quit();
    }

    // ── If there was a failure, re-run ONLY that test visually ────────────────
    if (failedTest) {
        const ft = tests.find(t => t['Test Name'].trim() === failedTest!.name)!;
        if (ft) {
            console.log(clr(C.bold + C.yellow, `  ↻  Re-running "${failedTest.name}" in a visible browser window…`));
            console.log('');

            const visibleDriver = await buildDriver(false);
            try {
                await visibleDriver.get(BASE_URL);
                await visibleDriver.wait(until.elementLocated(By.css('.cm-content')), TIMEOUT_MS);
                await visibleDriver.sleep(400);

                await setEditorCode(visibleDriver, ft['Program Code']?.trim() || '');

                const inputLines = ft['User Input']?.trim()
                    ? ft['User Input'].trim().split('\n').map(l => l.trim())
                    : [];

                await clickRun(visibleDriver);

                if (inputLines.length > 0) {
                    await supplyInputs(visibleDriver, inputLines);
                }

                await visibleDriver.sleep(RUN_SETTLE_MS);

                console.log(clr(C.yellow,
                    '  Browser left open so you can inspect the failing state.\n' +
                    '  Close it manually when you\'re done.'
                ));
                console.log('');

                // Keep the process alive until the browser is closed
                await new Promise<void>((resolve) => {
                    const poll = setInterval(async () => {
                        try {
                            await visibleDriver.getTitle(); // throws if window closed
                        } catch {
                            clearInterval(poll);
                            resolve();
                        }
                    }, 1000);
                });
            } finally {
                try { await visibleDriver.quit(); } catch (_) {/* already closed */ }
            }
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const total = passed + failed + errored;
    console.log('  ' + '─'.repeat(56));
    console.log(
        `  ${clr(C.bold, 'Results')}  ` +
        clr(C.green, `${passed} passed`) + '  ' +
        clr(C.red, `${failed} failed`) + '  ' +
        (errored ? clr(C.yellow, `${errored} errored`) + '  ' : '') +
        clr(C.dim, `(${total} run)`)
    );
    console.log('  ' + '─'.repeat(56));
    console.log('');

    // ── Write JSON report ─────────────────────────────────────────────────────
    const reportPath = path.join(__dirname, 'test-results.json');
    writeFileSync(
        reportPath,
        JSON.stringify({ summary: { passed, failed, errored, total }, results }, null, 2)
    );
    console.log(`  ${clr(C.dim, 'Full report →')} ${reportPath}`);
    console.log('');

    process.exit(failed + errored > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error(clr(C.red, '\n  Fatal error:'), err);
    process.exit(2);
});
