import { getDefaultQualifiers, Mixin, IQualifier, OperatorType, ScopeType } from "./qualifier"
import { NodeType, Parser } from "./parser"
import { FilterFunc, genTraverser, TraverseResult } from "./traverser";

class Finder {
    qualifiers!: Map<string, IQualifier>
    parser!: Parser

    constructor(qualifiers: IQualifier[] = []) {
        this.setQualifiers(qualifiers)
    }

    setQualifiers(qualifiers: IQualifier[]) {
        this.qualifiers = new Map([...getDefaultQualifiers(), ...qualifiers].map(q => [q.scope, q]))
        this.parser = new Parser([...this.qualifiers.keys()], [...Object.keys(Mixin.OPERATOR)])
    }

    async* find(query: string, dir: string, caseSensitive: boolean) {
        const ast = this.parse(query, caseSensitive)
        if (ast) {
            yield* this.findByAst(ast, dir, caseSensitive)
        }
    }

    async* findByAst(ast: NodeType, dir: string, caseSensitive: boolean) {
        const traverser = this.genTraverser(dir)
        yield* this._find(ast, traverser, caseSensitive)
    }

    async* _find(ast: NodeType, traverser: AsyncGenerator<TraverseResult>, caseSensitive: boolean) {
        for await (const source of traverser) {
            const callback = (node: NodeType) => this._match(node, source, caseSensitive)
            const ok = this.parser.evaluate(ast, callback)
            if (ok) {
                yield source
            }
        }
    }

    genTraverser(dir: string, fileFilters?: FilterFunc[], dirFilters?: FilterFunc[]) {
        if (!dir) {
            throw new Error("dir is must")
        }
        return genTraverser(dir, fileFilters, dirFilters)
    }

    parse(query: string, caseSensitive: boolean) {
        if (!query) {
            throw new Error("query is must")
        }
        query = caseSensitive ? query : query.toLowerCase()
        const ast = this.parser.parse(query)
        if (ast) {
            this.parser.traverse(ast, node => {
                const { scope = "default", operand = "=", operator, type } = node
                const qualifier = this.qualifiers.get(scope)!
                qualifier.validate(scope as ScopeType, operator as OperatorType, operand, type)
                node.castResult = qualifier.cast(operand, type)
            })
        }
        return ast
    }

    _match(node: NodeType, source: TraverseResult, caseSensitive: boolean): boolean {
        const { scope = "default", operator = "=", castResult, type } = node
        const qualifier = this.qualifiers.get(scope)
        if (!qualifier) return false

        let queryResult = qualifier.query(source)
        if (!caseSensitive) {
            if (typeof queryResult === "string") {
                queryResult = queryResult.toLowerCase()
            } else if (Array.isArray(queryResult) && queryResult[0] && typeof queryResult[0] === "string") {
                queryResult = queryResult.map(s => s.toLowerCase())
            }
        }
        return qualifier[type as "KEYWORD" | "PHRASE" | "REGEXP"](scope as ScopeType, operator as OperatorType, castResult, queryResult)
    }

    getGrammar() {
        const scope = [...this.qualifiers.keys()].map(s => `'${s}'`).join(" | ")
        const operator = [...Object.keys(Mixin.OPERATOR)].map(s => `'${s}'`).join(" | ")
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