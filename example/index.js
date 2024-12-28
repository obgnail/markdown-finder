const { Finder } = require("../dist/markdown-find.js")

const dir = "D:/myshare/Dropbox/root/md"
const caseSensitive = false

async function query() {
    const finder = new Finder()
    console.log(finder.getGrammar())

    const iterator = finder.find("size>10kb | content:abc", dir, caseSensitive)
    for await (const source of iterator) {
        console.log(source.path)
    }
}

async function queryByAST() {
    const finder = new Finder()
    const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
    const iterator = finder.findByAst(ast, dir, caseSensitive)
    for await (const source of iterator) {
        console.log(source.path)
    }
}

query()
queryByAST()