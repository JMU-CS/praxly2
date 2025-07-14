import {lezerParser} from "../language/praxis/highlighter.js";

let source = `for (int i = 0; i < 6; i = i + 1)
  print (i + 1) << 9
end for
print randomInt()
`;
// source = `print 5
// `;
// https://lezer.codemirror.net/docs/ref/#common.Tree.iterate
const tree = lezerParser.parse(source);
let level = 0;
tree.iterate({
  enter: node => {
    console.log(`${'  '.repeat(level)}${node.name} [${node.from} ${node.to}]`);
    if (node.type.isError) {
      console.log(`${'  '.repeat(level)}error ${node} ${node.from} ${node.to}`);
    }
    level += 1;
  },
  leave: _node => {
    level -= 1;
  },
});
