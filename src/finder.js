import { Parser } from "./parser.js"
import { genTraverser } from "./traverser.js"
import { QualifierMixin, getDefaultQualifiers } from "./qualifier.js"


class Finder {
    constructor(qualifiers = []) {
        this.setQualifiers(qualifiers)
    }

    setQualifiers(qualifiers) {
        this.qualifiers = new Map([...getDefaultQualifiers(), ...qualifiers].map(q => [q.scope, q]))
        this.parser = new Parser([...this.qualifiers.keys()], [...Object.keys(QualifierMixin.OPERATOR)])
    }

    async* find(query, dir, caseSensitive) {
        const ast = this.parse(query, caseSensitive)
        yield* this.findByAst(ast, dir, caseSensitive)
    }

    async* findByAst(ast, dir, caseSensitive) {
        const traverser = this.genTraverser(dir)
        yield* this._find(ast, traverser, caseSensitive)
    }

    async* _find(ast, traverser, caseSensitive) {
        for await (const source of traverser) {
            const callback = node => this._match(node, source, caseSensitive)
            const ok = this.parser.evaluate(ast, callback)
            if (ok) {
                yield source
            }
        }
    }

    genTraverser(dir, fileFilters, dirFilters) {
        if (!dir) {
            throw new Error("dir is must")
        }
        return genTraverser(dir, fileFilters, dirFilters)
    }

    parse(query, caseSensitive) {
        if (!query) {
            throw new Error("query is must")
        }
        query = caseSensitive ? query : query.toLowerCase()
        const ast = this.parser.parse(query)
        this.parser.traverse(ast, node => {
            const { scope, operator, operand, type: operandType } = node
            const qualifier = this.qualifiers.get(scope)
            qualifier.validate(scope, operator, operand, operandType)
            node.castResult = qualifier.cast(operand, operandType)
        })
        return ast
    }

    _match(node, source, caseSensitive) {
        const { scope, operator, castResult, type } = node
        const qualifier = this.qualifiers.get(scope)
        let queryResult = qualifier.query(source)
        if (!caseSensitive) {
            if (typeof queryResult === "string") {
                queryResult = queryResult.toLowerCase()
            } else if (Array.isArray(queryResult) && queryResult[0] && typeof queryResult[0] === "string") {
                queryResult = queryResult.map(s => s.toLowerCase())
            }
        }
        return qualifier[type](scope, operator, castResult, queryResult)
    }

    getGrammar() {
        const scope = [...this.qualifiers.keys()].map(s => `'${s}'`).join(" | ")
        const operator = [...Object.keys(QualifierMixin.OPERATOR)].map(s => `'${s}'`).join(" | ")
        return `
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
<keyword> ::= [^\\s"()|]+
<regexp> ::= [^/]+
<operator> ::= ${operator}
<scope> ::= ${scope}`
    }
}

export { Finder }
