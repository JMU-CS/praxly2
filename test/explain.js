import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import * as python from '../build/language/python/index.js';
import * as english from '../build/language/explain/index.js'
import * as error from '../build/language/error.js';
import {makeLogger, getInput} from './utilities.js';
import {Evaluator} from '../build/language/evaluator.js';
import {GlobalRuntime} from '../build/language/runtime.js';
import {Memdia} from '../build/language/memdia.js';

function testTranslation(sample, ast) {
  let targetSource = ast.visit(new english.Translator(), {
    nestingLevel: 0,
    indentation: '  ',
  });
  it(`should translate from praxis to english`, () => assert.equal(targetSource, sample.output));
}

function testProgram(sample) {
  describe(`// ${sample.message}\n${sample.source}`, () => {
    const tokens = praxis.lex(sample.source);
    const ast = praxis.parse(tokens, sample.source);
    testTranslation(sample, ast);
  });
}

function testExpression(sample) {
  describe(sample.source, () => {
    const tokens = praxis.lex(sample.source);
    const ast = praxis.parseExpression(tokens, sample.source);

    testTranslation(sample, ast);
  });
}

describe ("English : Translate Praxis Expressions to English", () => {
  const samples = [
    {
      source: '5 + 1',
      output: '5 plus 1'
    },
    {
      source: '5 - 4 - 3',
      output: '5 minus 4 minus 3'
    },
    {
      source: '2 ** 3',
      output: '2 raised to the power of 3'
    },
    {
      source: '10 % 2',
      output: 'the remainder when 10 is divided by 2'
    },
    {
      source: '20 / 4',
      output: '20 divided by 4'
    },
    {
      source: '3 * 5',
      output: '3 multiplied by 5'
    },
    {
      source: '6 < 7',
      output: '6 is less than 7'
    },
    {
      source: '55 > 20',
      output: '55 is greater than 20'
    },
    {
      source: '3 <= 4',
      output: '3 is less than or equal to 4'
    },
    {
      source: '10 >= x',
      output: '10 is greater than or equal to x'
    },
    {
      source: '5 == 5',
      output: '5 is equal to 5'
    },
    {
      source: 'x != 4',
      output: 'x is not equal to 4'
    },
    {
      source: 'not True and False',
      output: 'not True and False'
    },
    {
      source: 'True and False',
      output: 'True and False'
    },
    {
      source: 'x == 4 or x == 5',
      output: 'x is equal to 4 or x is equal to 5'
    },
    {
      source: 'x >> 2',
      output: 'shift x right by 2'
    },
        {
      source: 'x << 2',
      output: 'shift x left by 2'
    }

  ]

  samples.forEach(testExpression);
});

describe ("English : Translate Conditional statements from Praxis to English", () => {
  const samples = [
    {
      message: 'if-sans-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
end if
age--
if (age ≥ 18)
  print "vote"
end if`,
      output:
      `Declare a int named age with the value 18.\nif age is greater than or equal to 18 then print "vote".\ndecrement age by 1.\nif age is greater than or equal to 18 then print "vote".`
    },
    {
      message: 'if-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else
  print "stay home"
end if`,
      output:
      `Declare a int named age with the value 18.\nif age is greater than or equal to 18 then print "vote". Otherwise print "stay home".`
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
end if`,
      output:
      `Declare a int named age with the value 18.\nif age is greater than or equal to 18 then print "vote", if age is less than or equal to 12 then print "accompany". Otherwise print "stay home".`
    }
  ]

  samples.forEach(testProgram)
});

describe ("English : Translate Classes to from Praxis to English", () => {
  const samples = [
    {
      message: "New Class Dog",
      source:
`class Dog
  String name = "Bella"
  void bark()
    print "woof"
  end bark
end class Dog
`,
      output:
      `Define a class named Dog. It includes 1 instance variable, a variable named "name" of type String with the value "Bella", and a method called bark that takes no parameters. When called, the method will print "woof".`
    },
    {
      message: "New Class Dog with instantiation",
      source:
`class Dog
  String name = "Bella"
  void bark()
    print "woof"
  end bark
end class Dog

Dog myDog = new Dog
myDog.bark()`,
      output:
      `Define a class named Dog. It includes 1 instance variable, a variable named "name" of type String with the value "Bella", and a method called bark that takes no parameters. When called, the method will print "woof".\n\nCreate a new instance of a Dog and assign it to a variable named myDog.\nCall the bark method on myDog.`
    },
    {
      message: "Class with one instance variable",
      source:
`class Person
  int id = 11
end class Person`,
      output:
      `Define a class named Person. It includes 1 instance variable, a variable named "id" of type int with the value 11.`
    },
    {
      message: "Class with only instance variables",
      source:
`class Person
  int id = 11
  String name = "Elsa"
end class Person`,
      output:
      `Define a class named Person. It includes 2 instance variables, a variable named "id" of type int with the value 11 and a variable named "name" of type String with the value "Elsa".`
    },
    {
      message: "Classes with superclass",
      source:
`class Student extends Person
  String nameTag = "Halsey"
end class Student`,
      output:
      `Define a class named Student that extends the Person class. It includes 1 instance variable, a variable named "nameTag" of type String with the value "Halsey".`
    },
    {
      message: "Class with one method",
      source:
`class Instrument
  void play()
    print "lalala"
  end play
end class Instrument`,
      output:
      `Define a class named Instrument. It includes 1 method called play that takes no parameters. When called, the method will print "lalala".`
    },
    {
      message: "Class with multiple methods",
      source:
`class Calculator
  public int add(int a, int b)
    return a + b
  end add
  public int subtract(int a, int b)
    return a - b
  end subtract
end class Calculator`,
      output:
      `Define a class named Calculator. It includes 2 methods. There is add that takes 2 parameters, a and b. When called, the method will return a plus b and subtract that takes 2 parameters, a and b. When called, the method will return a minus b.`
    }
  ];

  samples.forEach(testProgram);
});
