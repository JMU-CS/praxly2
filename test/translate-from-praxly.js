import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import * as python from '../build/language/python/index.js';

describe('Translate Expressions', () => {
  const samples = [
    {
      source: '5 + 1',
      translation: {
        praxis: "5 + 1",
        python: "5 + 1",
      },
    },
    {
      source: '5 - 4 - 3',
      translation: {
        praxis: '5 - 4 - 3',
        python: '5 - 4 - 3',
      },
    },
    {
      source: 'true and false',
      translation: {
        praxis: 'true and false',
        python: 'True and False',
      },
    },
    {
      source: 'false or true',
      translation: {
        praxis: 'false or true',
        python: 'False or True',
      },
    },
    {
      source: 'not true',
      translation: {
        praxis: 'not true',
        python: 'not True',
      },
    },
    {
      source: 'not not true',
      translation: {
        praxis: 'not not true',
        python: 'not not True',
      },
    },
    {
      source: '6 < 7',
      translation: {
        praxis: '6 < 7',
        python: '6 < 7',
      },
    },
    {
      source: '"blink" == "blank"',
      translation: {
        praxis: '"blink" == "blank"',
        python: '"blink" == "blank"',
      },
    },
    {
      source: '"blink" != "blank"',
      translation: {
        praxis: '"blink" ≠ "blank"',
        python: '"blink" != "blank"',
      },
    },
    {
      source: 'not false and true',
      translation: {
        praxis: 'not false and true',
        python: 'not False and True',
      },
    },
    {
      source: 'not false and false',
      translation: {
        praxis: 'not false and false',
        python: 'not False and False',
      },
    },
    {
      source: '7 / 3',
      translation: {
        praxis: '7 / 3',
        python: '7 / 3',
      },
    },
    {
      source: '7.0 / 4',
      translation: {
        praxis: '7.0 / 4',
        python: '7.0 / 4',
      },
    },
    {
      source: '10.5 / 0.5',
      translation: {
        praxis: '10.5 / 0.5',
        python: '10.5 / 0.5',
      },
    },
    {
      source: '5 + 2 * 3.0',
      translation: {
        praxis: '5 + 2 * 3.0',
        python: '5 + 2 * 3.0',
      },
    },
    {
      source: '5 + 2 * 3.0',
      translation: {
        praxis: '5 + 2 * 3.0',
        python: '5 + 2 * 3.0',
      },
    },
    {
      source: '-2 % 5',
      translation: {
        praxis: '-2 % 5',
        python: '-2 % 5',
      },
    },
    {
      source: 'sqrt(0.25)',
      translation: {
        praxis: 'sqrt(0.25)',
        python: 'sqrt(0.25)',
      },
    },
    {
      source: 'max(5, 689)',
      translation: {
        praxis: 'max(5, 689)',
        python: 'max(5, 689)',
      },
    },
    {
      source: 'min(5, 689)',
      translation: {
        praxis: 'min(5, 689)',
        python: 'min(5, 689)',
      },
    },
    {
      source: 'abs(6)',
      translation: {
        praxis: 'abs(6)',
        python: 'abs(6)',
      },
    },
    {
      source: 'abs(-6)',
      translation: {
        praxis: 'abs(-6)',
        python: 'abs(-6)',
      },
    },
    {
      source: 'abs(0)',
      translation: {
        praxis: 'abs(0)',
        python: 'abs(0)',
      },
    },
    {
      source: 'log(1.0)',
      translation: {
        praxis: 'log(1.0)',
        python: 'log(1.0)',
      },
    },
    {
      source: 'log(1)',
      translation: {
        praxis: 'log(1)',
        python: 'log(1)',
      },
    },
    {
      source: 'log(1)',
      translation: {
        praxis: 'log(1)',
        python: 'log(1)',
      },
    },
    {
      source: 'log(10)',
      translation: {
        praxis: 'log(10)',
        python: 'log(10)',
      },
    },
  ];

  for (let sample of samples) {
    describe(sample.source, () => {
      const tokens = praxis.lex(sample.source);
      const ast = praxis.parseExpression(tokens, sample.source);

      const platforms = [
        {language: 'praxis', module: praxis},
        {language: 'python', module: python},
      ];

      for (let {language, module} of platforms) {
        const generatedSource = ast.visit(new module.Translator(), {
          nestingLevel: 0,
          indentation: '  ',
        });
        it(`should translate to ${language} code ${sample.translation[language]}`, () => assert.equal(generatedSource, sample.translation[language]));
      }
    });
  }
});

describe('Translate Full Programs', () => {
  const samples = [
    {
      message: 'print sum',
      source: 'print 5 + 1',
      translation: {
        praxis: "print 5 + 1\n",
        python: "print(5 + 1)\n",
      },
    },
    {
      message: 'print compound expression',
      source: 'print (7 * (3 + 1))',
      translation: {
        praxis: "print (7 * (3 + 1))\n",
        python: "print(7 * (3 + 1))\n",
      },
    },
    {
      message: 'print array',
      source: `int[] xs \u2b60 {12, 103, 88}
print xs
print xs[0]
print xs[1]
print xs[2]
print xs.length
`,
      translation: {
        praxis: `int[] xs \u2b60 {12, 103, 88}
print xs
print xs[0]
print xs[1]
print xs[2]
print xs.length
`,
        python: `xs = [12, 103, 88]
print(xs)
print(xs[0])
print(xs[1])
print(xs[2])
print(len(xs))
`,
      },
    },
    {
      message: 'print int increments and decrements',
      source: `int x \u2b60 13
x++
print x
x++
print x
x--
print x
x--
print x
`,
      translation: {
        praxis: `int x \u2b60 13
x++
print x
x++
print x
x--
print x
x--
print x
`,
        python: `x = 13
x = x + 1
print(x)
x = x + 1
print(x)
x = x - 1
print(x)
x = x - 1
print(x)
`,
      },
    },
    {
      message: 'print float increments and decrements',
      source: `float x \u2b60 13.2
x++
print x
x++
print x
x--
print x
x--
print x
`,
      translation: {
        praxis: `float x \u2b60 13.2
x++
print x
x++
print x
x--
print x
x--
print x
`,
        python: `x = 13.2
x = x + 1
print(x)
x = x + 1
print(x)
x = x - 1
print(x)
x = x - 1
print(x)
`,
      },
    },
    {
      message: 'print array element increments and decrements',
      source: `int[] counts \u2b60 {100, 500}
counts[0]++
counts[1]--
print counts
counts[0]--
counts[1]++
print counts
`,
      translation: {
        praxis: `int[] counts \u2b60 {100, 500}
counts[0]++
counts[1]--
print counts
counts[0]--
counts[1]++
print counts
`,
        python: `counts = [100, 500]
counts[0] = counts[0] + 1
counts[1] = counts[1] - 1
print(counts)
counts[0] = counts[0] - 1
counts[1] = counts[1] + 1
print(counts)
`,
      },
    },
    {
      message: 'if-sans-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
end if
age--
if (age ≥ 18)
  print "vote"
end if
`,
      translation: {
        praxis: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
end if
age--
if (age ≥ 18)
  print "vote"
end if
`,
        python: `age = 18
if age >= 18:
  print("vote")
age = age - 1
if age >= 18:
  print("vote")
`,
      },
    },
    {
      message: 'if-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else
  print "stay home"
end if
age--
if (age ≥ 18)
  print "vote"
else
  print "stay home"
end if
`,
      translation: {
        praxis: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else
  print "stay home"
end if
age--
if (age ≥ 18)
  print "vote"
else
  print "stay home"
end if
`,
        python: `age = 18
if age >= 18:
  print("vote")
else:
  print("stay home")
age = age - 1
if age >= 18:
  print("vote")
else:
  print("stay home")
`,
      },
    },
    {
      message: 'if-else-if statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
age \u2b60 12
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
age \u2b60 14
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
`,
      translation: {
        praxis: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
age \u2b60 12
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
age \u2b60 14
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
`,
        python: `age = 18
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
else:
  print("stay home")
age = 12
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
else:
  print("stay home")
age = 14
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
else:
  print("stay home")
`,
      },
    },
    {
      message: 'if-else-if-sans-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
age \u2b60 12
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
age \u2b60 14
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
`,
      translation: {
        praxis: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
age \u2b60 12
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
age \u2b60 14
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
`,
        python: `age = 18
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
age = 12
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
age = 14
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
`,
      },
    },
    {
      message: 'shadowing',
      source: `int x \u2b60 5
for (int x \u2b60 0; x < 3; x \u2b60 x + 1)
  print x
end for
print x
`,
      translation: {
        praxis: `int x \u2b60 5
for (int x \u2b60 0; x < 3; x \u2b60 x + 1)
  print x
end for
print x
`,
        python: `x = 5
x = 0
while x < 3:
  print(x)
  x = x + 1
print(x)
`,
      },
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      const tokens = praxis.lex(sample.source);
      const ast = praxis.parse(tokens, sample.source);

      const platforms = [
        {language: 'praxis', module: praxis},
        {language: 'python', module: python},
      ];
      
      for (let {language, module} of platforms) {
        const generatedSource = ast.visit(new module.Translator(), {
          nestingLevel: 0,
          indentation: '  ',
        });
        const expectedSerialization = sample.translation[language];
        it(`should translate to ${language} code\n${expectedSerialization}`, () => assert.equal(generatedSource, expectedSerialization));
      }
    });
  }
});
