import { Builder, By, until, Key, WebDriver } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome.js';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Configuration ───────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173/v2/editor';
const CSV_PATH = path.join(__dirname, 'praxly.test.csv');

type ResetMode = 'clear' | 'reload';

interface CliOptions {
  filter?: string;
  testName?: string;
  testIndex?: number;
  fromName?: string;
  fromIndex?: number;
  timeoutMs?: number;
  runSettleMs?: number;
  inputDelayMs?: number;
  inputWaitMs?: number;
  startupSettleMs?: number;
  headless?: boolean;
  failFast?: boolean;
  rerunOnFail?: boolean;
  resetMode?: ResetMode;
  showHelp?: boolean;
}

interface RunnerOptions {
  testFilter: string;
  testName: string;
  testIndex: number;
  fromName: string;
  fromIndex: number;
  timeoutMs: number;
  runSettleMs: number;
  inputDelayMs: number;
  inputWaitMs: number;
  startupSettleMs: number;
  headless: boolean;
  failFast: boolean;
  rerunOnFail: boolean;
  resetMode: ResetMode;
}

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
}

function parsePositiveIntFlag(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNonNegativeIntFlag(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function printUsage(): void {
  console.log(`
Usage: npx tsx csv/selenium.test.ts [options]

Selection options:
  --filter <text>          Run tests whose name includes <text>
  --test <name>            Run a single test by exact name
  --test-index <n>         Run a single test by 1-based index in the CSV
  --from <text>            Start from first test whose name includes <text>
  --from-index <n>         Start from 1-based index in the CSV

Runtime options:
  --headless               Run in headless Chrome (default)
  --headed                 Run in visible Chrome window
  --fail-fast              Stop at first failing test (default)
  --no-fail-fast           Continue running after failures
  --reset-mode <mode>      clear (default) | reload
  --run-settle-ms <n>      Wait after clicking Run (default: 150)
  --input-delay-ms <n>     Delay between stdin entries (default: 60)

Examples:
  npm run test-browser -- --test "Print once"
  npm run test-browser -- --from-index 120
  npm run test-browser -- --filter "Array" --no-fail-fast
`);
}

function parseCliArgs(args: string[]): CliOptions {
  const cli: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        cli.showHelp = true;
        break;
      case '--filter':
        cli.filter = next ?? '';
        i++;
        break;
      case '--test':
        cli.testName = next ?? '';
        i++;
        break;
      case '--test-index':
        cli.testIndex = parsePositiveIntFlag(next);
        i++;
        break;
      case '--from':
        cli.fromName = next ?? '';
        i++;
        break;
      case '--from-index':
        cli.fromIndex = parsePositiveIntFlag(next);
        i++;
        break;
      case '--timeout-ms':
        cli.timeoutMs = parseNonNegativeIntFlag(next);
        i++;
        break;
      case '--run-settle-ms':
        cli.runSettleMs = parseNonNegativeIntFlag(next);
        i++;
        break;
      case '--input-delay-ms':
        cli.inputDelayMs = parseNonNegativeIntFlag(next);
        i++;
        break;
      case '--input-wait-ms':
        cli.inputWaitMs = parseNonNegativeIntFlag(next);
        i++;
        break;
      case '--startup-settle-ms':
        cli.startupSettleMs = parseNonNegativeIntFlag(next);
        i++;
        break;
      case '--headless':
        cli.headless = true;
        break;
      case '--headed':
        cli.headless = false;
        break;
      case '--fail-fast':
        cli.failFast = true;
        break;
      case '--no-fail-fast':
        cli.failFast = false;
        break;
      case '--rerun-fail':
        cli.rerunOnFail = true;
        break;
      case '--no-rerun-fail':
        cli.rerunOnFail = false;
        break;
      case '--reset-mode': {
        const mode = (next ?? '').toLowerCase();
        if (mode === 'clear' || mode === 'reload') {
          cli.resetMode = mode;
        }
        i++;
        break;
      }
      case '--reload-between-tests':
        cli.resetMode = 'reload';
        break;
      case '--clear-between-tests':
        cli.resetMode = 'clear';
        break;
      default:
        break;
    }
  }

  return cli;
}

function resolveRunnerOptions(): RunnerOptions {
  const cli = parseCliArgs(process.argv.slice(2));

  if (cli.showHelp) {
    printUsage();
    process.exit(0);
  }

  const envResetModeRaw = (process.env.RESET_MODE ?? '').toLowerCase();
  const envResetMode =
    envResetModeRaw === 'clear' || envResetModeRaw === 'reload' ? envResetModeRaw : undefined;

  return {
    testFilter: cli.filter ?? process.env.TEST_FILTER ?? '',
    testName: cli.testName ?? process.env.TEST_NAME ?? '',
    testIndex: cli.testIndex ?? parsePositiveIntFlag(process.env.TEST_INDEX) ?? 0,
    fromName: cli.fromName ?? process.env.START_FROM ?? '',
    fromIndex: cli.fromIndex ?? parsePositiveIntFlag(process.env.START_INDEX) ?? 0,
    timeoutMs: cli.timeoutMs ?? parseNonNegativeIntFlag(process.env.TIMEOUT_MS) ?? 10_000,
    runSettleMs: cli.runSettleMs ?? parseNonNegativeIntFlag(process.env.RUN_SETTLE_MS) ?? 150,
    inputDelayMs: cli.inputDelayMs ?? parseNonNegativeIntFlag(process.env.INPUT_DELAY_MS) ?? 60,
    inputWaitMs: cli.inputWaitMs ?? parseNonNegativeIntFlag(process.env.INPUT_WAIT_MS) ?? 2_500,
    startupSettleMs:
      cli.startupSettleMs ?? parseNonNegativeIntFlag(process.env.STARTUP_SETTLE_MS) ?? 200,
    headless: cli.headless ?? parseBooleanFlag(process.env.HEADLESS) ?? true,
    failFast: cli.failFast ?? parseBooleanFlag(process.env.FAIL_FAST) ?? true,
    rerunOnFail: cli.rerunOnFail ?? parseBooleanFlag(process.env.RERUN_ON_FAIL) ?? true,
    resetMode: cli.resetMode ?? envResetMode ?? 'clear',
  };
}

const OPTIONS = resolveRunnerOptions();

const TEST_FILTER = OPTIONS.testFilter;
const TEST_NAME = OPTIONS.testName;
const TEST_INDEX = OPTIONS.testIndex;
const START_FROM = OPTIONS.fromName;
const START_INDEX = OPTIONS.fromIndex;

const TIMEOUT_MS = OPTIONS.timeoutMs; // max wait for elements
const RUN_SETTLE_MS = OPTIONS.runSettleMs; // pause after Run before reading output
const INPUT_DELAY_MS = OPTIONS.inputDelayMs; // pause between stdin lines
const INPUT_WAIT_MS = OPTIONS.inputWaitMs; // wait for stdin prompt per line
const STARTUP_SETTLE_MS = OPTIONS.startupSettleMs;
const EDITOR_ACTION_DELAY_MS = Math.min(80, Math.max(20, Math.floor(INPUT_DELAY_MS / 2) || 40));

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
    clr(C.green, `${passed}✓`) +
    ' ' +
    clr(C.red, `${failed}✗`) +
    ' ' +
    clr(C.dim, `${done}/${total}`);

  process.stdout.write(`\r  [${bar}] ${stats}  `);
}

// ─── Normalise output for comparison ─────────────────────────────────────────

function normalise(s: string = ''): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
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
    .setChromeOptions(opts as any)
    .build();
}

// ─── Editor interaction helpers ───────────────────────────────────────────────

/**
 * Clear the CodeMirror editor completely and replace its content.
 */
async function setEditorCode(driver: WebDriver, code: string): Promise<void> {
  const cmContent = await driver.wait(until.elementLocated(By.css('.cm-content')), TIMEOUT_MS);
  await cmContent.click();

  // Select-all and delete
  const selectAll =
    process.platform === 'darwin' ? Key.chord(Key.COMMAND, 'a') : Key.chord(Key.CONTROL, 'a');

  await cmContent.sendKeys(selectAll);
  await driver.sleep(EDITOR_ACTION_DELAY_MS);
  await cmContent.sendKeys(Key.DELETE);
  await driver.sleep(EDITOR_ACTION_DELAY_MS * 2);

  // Type the new source code
  await cmContent.sendKeys(code);
  await driver.sleep(EDITOR_ACTION_DELAY_MS);
}

/**
 * Click the "Run Code" button in the header toolbar.
 */
async function clickRun(driver: WebDriver): Promise<void> {
  const runBtn = await driver.findElement(By.xpath("//button[contains(., 'Run Code')]"));
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
        INPUT_WAIT_MS
      );
      await driver.wait(until.elementIsVisible(inputEl), TIMEOUT_MS);

      // Clear can trigger onChange, but sometimes React needs a discrete event
      await inputEl.clear();
      await inputEl.sendKeys(line);

      // Click the Submit button to ensure the input is processed
      // The button is a sibling or near the input in the DOM
      try {
        const submitBtn = await driver.findElement(By.xpath("//button[contains(., 'Submit')]"));
        await submitBtn.click();
      } catch (e) {
        // If submit button not found, try Enter key (fallback)
        await inputEl.sendKeys(Key.RETURN);
      }

      // Important: Wait for the input element to disappear or be replaced
      // This ensures we don't try to enter the next input into the OLD field
      try {
        await driver.wait(until.stalenessOf(inputEl), INPUT_WAIT_MS);
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
    const lineDivs = await outputContainer.findElements(By.css('div.flex.gap-4'));

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
 * Full reset by navigating to the editor URL.
 */
async function reloadEditorState(driver: WebDriver): Promise<void> {
  await driver.get(BASE_URL);
  await driver.wait(until.elementLocated(By.css('.cm-content')), TIMEOUT_MS);
  await driver.sleep(STARTUP_SETTLE_MS);
}

/**
 * Fast reset by clicking the editor toolbar Clear button.
 */
async function clearEditorState(driver: WebDriver): Promise<boolean> {
  try {
    const clearBtn = await driver.findElement(By.xpath("//button[contains(., 'Clear')]"));
    await clearBtn.click();
    await driver.sleep(EDITOR_ACTION_DELAY_MS);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset state between tests using either a fast clear or full reload.
 */
async function resetEditorState(driver: WebDriver): Promise<void> {
  if (OPTIONS.resetMode === 'reload') {
    await reloadEditorState(driver);
    return;
  }

  const didClear = await clearEditorState(driver);
  if (!didClear) {
    await reloadEditorState(driver);
  }
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

function selectTests(allRecords: TestRow[]): TestRow[] {
  let tests = TEST_FILTER
    ? allRecords.filter((r) => (r['Test Name'] ?? '').includes(TEST_FILTER))
    : [...allRecords];

  if (START_INDEX > 0) {
    tests = tests.slice(Math.max(0, START_INDEX - 1));
  } else if (START_FROM) {
    const fromIndex = tests.findIndex((r) => (r['Test Name'] ?? '').includes(START_FROM));
    tests = fromIndex >= 0 ? tests.slice(fromIndex) : [];
  }

  if (TEST_INDEX > 0) {
    tests = tests[TEST_INDEX - 1] ? [tests[TEST_INDEX - 1]] : [];
  } else if (TEST_NAME) {
    tests = tests.filter((r) => (r['Test Name'] ?? '').trim() === TEST_NAME.trim());
  }

  return tests;
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

  const tests = selectTests(allRecords);
  const selectionParts: string[] = [];
  if (TEST_FILTER) selectionParts.push(`filter: "${TEST_FILTER}"`);
  if (START_INDEX > 0) selectionParts.push(`from index: ${START_INDEX}`);
  else if (START_FROM) selectionParts.push(`from: "${START_FROM}"`);
  if (TEST_INDEX > 0) selectionParts.push(`only index: ${TEST_INDEX}`);
  else if (TEST_NAME) selectionParts.push(`only: "${TEST_NAME}"`);

  if (tests.length === 0) {
    console.log(clr(C.red, '  No tests matched the current selection options.'));
    process.exit(1);
  }

  // ── Header ────────────────────────────────────────────────────────────────
  console.log('');
  console.log(clr(C.bold + C.cyan, '  ╔══════════════════════════════════════╗'));
  console.log(clr(C.bold + C.cyan, '  ║       PRAXLY  TEST  RUNNER           ║'));
  console.log(clr(C.bold + C.cyan, '  ╚══════════════════════════════════════╝'));
  console.log('');
  console.log(`  ${clr(C.dim, 'URL    :')} ${BASE_URL}`);
  console.log(`  ${clr(C.dim, 'CSV    :')} ${CSV_PATH}`);
  console.log(
    `  ${clr(C.dim, 'Tests  :')} ${tests.length} / ${allRecords.length}` +
      (selectionParts.length > 0 ? `  ${clr(C.yellow, `(${selectionParts.join(' | ')})`)}` : '')
  );
  console.log(
    `  ${clr(C.dim, 'Mode   :')} ${OPTIONS.headless ? 'headless' : 'headed'} | reset=${OPTIONS.resetMode} | failFast=${OPTIONS.failFast}`
  );
  console.log(
    `  ${clr(C.dim, 'Delay  :')} run=${RUN_SETTLE_MS}ms | stdin=${INPUT_DELAY_MS}ms | startup=${STARTUP_SETTLE_MS}ms`
  );
  console.log('');

  // ── Build headless driver ─────────────────────────────────────────────────
  let driver = await buildDriver(OPTIONS.headless);
  let passed = 0;
  let failed = 0;
  let errored = 0;
  const results: TestResult[] = [];
  let failedTest: TestResult | null = null;

  try {
    await driver.get(BASE_URL);
    await driver.wait(until.elementLocated(By.css('.cm-content')), TIMEOUT_MS);
    await driver.sleep(STARTUP_SETTLE_MS);

    // ── Test loop ───────────────────────────────────────────────────────────
    for (const [idx, test] of tests.entries()) {
      const name = test['Test Name']?.trim() || `test_${idx}`;
      const code = test['Program Code']?.trim() || '';
      const rawInput = test['User Input']?.trim() || '';
      const expectedOut = test['Expected Output']?.trim() || '';
      const expectedErr = test['Expected Error']?.trim() || '';
      const inputLines = rawInput ? rawInput.split('\n').map((l) => l.trim()) : [];

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
        name,
        status,
        message,
        actualOut,
        actualErr,
        expectedOut,
        expectedErr,
      };
      results.push(result);

      // ── Print the individual test row ──────────────────────────────────────
      const icon =
        status === 'PASS'
          ? clr(C.green, '✓')
          : status === 'FAIL'
            ? clr(C.red, '✗')
            : clr(C.yellow, '⚠');
      const label =
        status === 'PASS'
          ? clr(C.green, 'PASS')
          : status === 'FAIL'
            ? clr(C.red, 'FAIL')
            : clr(C.yellow, 'ERROR');
      const num = clr(C.dim, `[${String(idx + 1).padStart(3)}]`);

      // Overwrite the progress bar line, then print the result on a new line
      process.stdout.write('\r');
      console.log(`  ${num} ${icon} ${label}  ${name}`);

      if (status !== 'PASS') {
        if (!failedTest) failedTest = result;

        // Print the diff
        console.log('');
        message.split('\n').forEach((l) => console.log(`        ${clr(C.dim, l)}`));
        console.log('');

        if (OPTIONS.failFast) {
          console.log(
            clr(C.bold + C.red, '  ✖  Test failed — fail-fast is enabled, stopping suite...')
          );
          console.log('');
          break;
        }
      }
    }
  } finally {
    await driver.quit();
  }

  // ── If there was a failure, re-run ONLY that test visually ────────────────
  if (failedTest && OPTIONS.failFast && OPTIONS.rerunOnFail && OPTIONS.headless) {
    const ft = tests.find((t) => t['Test Name'].trim() === failedTest!.name)!;
    if (ft) {
      console.log(
        clr(C.bold + C.yellow, `  ↻  Re-running "${failedTest.name}" in a visible browser window…`)
      );
      console.log('');

      const visibleDriver = await buildDriver(false);
      try {
        await visibleDriver.get(BASE_URL);
        await visibleDriver.wait(until.elementLocated(By.css('.cm-content')), TIMEOUT_MS);
        await visibleDriver.sleep(STARTUP_SETTLE_MS);

        await setEditorCode(visibleDriver, ft['Program Code']?.trim() || '');

        const inputLines = ft['User Input']?.trim()
          ? ft['User Input']
              .trim()
              .split('\n')
              .map((l) => l.trim())
          : [];

        await clickRun(visibleDriver);

        if (inputLines.length > 0) {
          await supplyInputs(visibleDriver, inputLines);
        }

        await visibleDriver.sleep(RUN_SETTLE_MS);

        console.log(
          clr(
            C.yellow,
            '  Browser left open so you can inspect the failing state.\n' +
              "  Close it manually when you're done."
          )
        );
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
        try {
          await visibleDriver.quit();
        } catch (_) {
          /* already closed */
        }
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passed + failed + errored;
  console.log('  ' + '─'.repeat(56));
  console.log(
    `  ${clr(C.bold, 'Results')}  ` +
      clr(C.green, `${passed} passed`) +
      '  ' +
      clr(C.red, `${failed} failed`) +
      '  ' +
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

runTests().catch((err) => {
  console.error(clr(C.red, '\n  Fatal error:'), err);
  process.exit(2);
});
