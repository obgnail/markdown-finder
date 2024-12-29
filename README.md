# Markdown Finder

English | [简体中文](https://github.com/obgnail/markdown-finder/blob/master/README.zh-CN.md)

Markdown Finder is a Node.js tool designed to search for Markdown files within a local directory. It supports complex grammar queries to precisely locate the required files.



## Features

- Supports complex grammar queries, including file path, file name, extension, size, time, line number, character count, and more.
- Supports regular expression queries.
- Supports querying through an Abstract Syntax Tree (AST).



## Usage Examples

```javascript
import { Finder } from "../dist/markdown-finder.js"

const finder = new Finder()
const dir = "D:/root/md"
const caseSensitive = false

// Show the query grammar
console.log(finder.getGrammar())

async function query() {
    // This query finds Markdown files that are larger than 10KB OR contain the text "abc".
    const q = "size>10kb | content:abc"
    const files = finder.find(q, dir, caseSensitive)
    for await (const file of files) {
        console.log(file.path)
    }
}

async function queryByAST() {
    // This query finds Markdown files that have a file name contains three lowercase letters and contain a Python code block.
    const ast = finder.parse(`file:/[a-z]{3}/ blockcodelang:python`)
    const files = finder.findByAst(ast, dir, caseSensitive)
    for await (const file of files) {
        console.log(file.path)
    }
}

query()
queryByAST()
```



## Grammar Explanation

```
<query> ::= <expression>
<expression> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <conjunction> <factor> )*
<factor> ::= <qualifier>? <match>
<qualifier> ::= <scope> <operator>
<match> ::= <keyword> | '"'<keyword>'"' | '/'<regexp>'/' | '('<expression>')'
<conjunction> ::= <and> | <not>
<or> ::= 'OR' | '|'
<and> ::= 'AND' | ' '
<not> ::= '-'
<keyword> ::= [^\s"()|]+
<regexp> ::= [^/]+
<operator> ::= ':' | '=' | '!=' | '>=' | '<=' | '>' | '<'
<scope> ::= 'path' | 'file' | 'ext' | 'time' | 'size' | 'linenum' | 'charnum' | 'chinesenum' | 'crlf' | 'hasimage' | 'haschinese' | 'default' | 'content' | 'line' | 'blockcode' | 'blockcodelang' | 'blockcodebody' | 'blockcodeline' | 'blockhtml' | 'blockquote' | 'table' | 'thead' | 'tbody' | 'ol' | 'ul' | 'task' | 'taskdone' | 'tasktodo' | 'head' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'highlight' | 'image' | 'code' | 'link' | 'strong' | 'em' | 'del'
```

| Example                                                      | Searches for documents where...                              |
| :----------------------------------------------------------- | :----------------------------------------------------------- |
| pear                                                         | ...the content contains "pear". (Equivalent to `default:pear`) |
| sour pear                                                    | ...the content contains both "sour" and "pear". (Equivalent to `sour AND pear`) |
| sour \| pear                                                 | ...the content contains "sour" OR "pear". (Equivalent to `sour OR pear`) |
| "sour pear"                                                  | ...the content contains the exact phrase "sour pear".        |
| sour pear -apple                                             | ...the content contains both "sour" and "pear", but does NOT contain "apple". |
| /\bsour\b/ pear time=2024-03-12                              | ...the content contains the word "sour" (whole-word match), also contains "pear", and the file was last modified on 2024-03-12. |
| head=plugin \| strong:MIT                                    | ...the heading content is the word "plugin", AND the text marked as strong contains “MIT” |
| size>10k (linenum>=1000 \| hasimage=true)                    | …the file size is greater than 10KB, AND the file either has at least 1000 lines or contains images. |
| path:(info \| warn \| err) -ext:md                           | …the file path contains 'info', 'warn', or 'err', AND the file extension does not contain 'md' |
| file:/[a-z]{3}/ content:prometheus blockcode:"kubectl apply" | ...the file name matches the regular expression `/[a-z]{3}/`, AND the content contains "prometheus", AND a code block contains the phrase "kubectl apply". |

