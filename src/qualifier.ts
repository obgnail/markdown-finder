import { extname } from "path"
import MarkdownIt, { default as MarkdownIT } from "markdown-it"
import { TYPE } from "./parser"
import { TraverseResult } from "./traverser"

type OperatorType = ":" | "=" | "!=" | ">=" | "<=" | ">" | "<"
type UnitType = "k" | "m" | "g" | "kb" | "mb" | "gb"
type OperandType = keyof typeof TYPE

interface IValidate {
    (scope: string, operator: OperatorType, operand: string, operandType: OperandType): void
}

interface ICast {
    (operand: string, operandType: OperandType): any
}

interface IQuery {
    (r: TraverseResult): any
}

interface IMatch {
    (scope: string, operator: OperatorType, operand: any, queryResult: any): boolean
}

interface IQualifier {
    // Qualifier scope
    scope: string
    // Name for explain
    name: string
    // Is Qualifier scope a metadata property
    is_meta: boolean
    // Checks user input; defaults to `QualifierMixin.VALIDATE.isStringOrRegexp`
    validate: IValidate
    // Converts user input for easier matching; defaults to `QualifierMixin.CAST.toStringOrRegexp`
    cast: ICast
    // Retrieves data from source
    query: IQuery
    // Matches castResult with queryResult when the user input is a keyword; defaults to `QualifierMixin.MATCH.compare`
    KEYWORD: IMatch
    // Matches castResult with queryResult when the user input is a phrase; behaves the same as `match_keyword` by default
    PHRASE: IMatch
    // Matches castResult with queryResult when the user input is a regexp; defaults to `QualifierMixin.MATCH.regexp`
    REGEXP: IMatch
}

function truncateTime(operand: string | Date): number {
    return new Date(operand).setHours(0, 0, 0, 0)
}

function setDefault(q: any): IQualifier {
    q.validate = q.validate || Mixin.VALIDATE.isStringOrRegexp
    q.cast = q.cast || Mixin.CAST.toStringOrRegexp
    q.KEYWORD = q.match_keyword || Mixin.MATCH.primitiveCompare
    q.PHRASE = q.match_phrase || q.KEYWORD
    q.REGEXP = q.match_regexp || Mixin.MATCH.stringRegexp
    return q
}

interface IOperator {
    (a: string, b: string): boolean

    <T extends string | number>(a: T, b: T): boolean
}

class Mixin {
    static readonly OPERATOR: Record<OperatorType, IOperator> = {
        ":": (a: string, b: string) => a.includes(b),
        "=": <T>(a: T, b: T) => a === b,
        "!=": <T>(a: T, b: T) => a !== b,
        ">=": <T>(a: T, b: T) => a >= b,
        "<=": <T>(a: T, b: T) => a <= b,
        ">": <T>(a: T, b: T) => a > b,
        "<": <T>(a: T, b: T) => a < b,
    }

    static readonly OPERATOR_NAME: Record<OperatorType, string> = {
        ":": "包含",
        "=": "为",
        "!=": "不为",
        ">=": "大于等于",
        "<=": "小于等于",
        ">": "大于",
        "<": "小于",
    }

    static readonly UNITS: Record<UnitType, number> = {
        k: 1 << 10,
        m: 1 << 20,
        g: 1 << 30,
        kb: 1 << 10,
        mb: 1 << 20,
        gb: 1 << 30,
    }

    static readonly VALIDATE: Record<string, IValidate> = {
        isStringOrRegexp: (scope: string, operator: OperatorType, operand: string, operandType: OperandType) => {
            if (operandType === "REGEXP") {
                if (operator !== ":") {
                    throw new Error(`In ${scope.toUpperCase()}: RegExp operands only support the ":" operator`)
                }
                try {
                    new RegExp(operand)
                } catch (e) {
                    throw new Error(`In ${scope.toUpperCase()}: Invalid regular expression: "${operand}"`)
                }
            }
            if (operator !== ":" && operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope.toUpperCase()}: Only supports "=", "!=", and ":" operators`)
            }
        },
        isComparable: (scope: string, operator: OperatorType, operand: string, operandType: OperandType) => {
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope.toUpperCase()}: RegExp operands are not valid for comparisons`)
            }
            if (operator === ":") {
                throw new Error(`In ${scope.toUpperCase()}: The ":" operator is not valid for comparisons`)
            }
        },
        isBoolean: (scope: string, operator: OperatorType, operand: string, operandType: OperandType) => {
            if (operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope.toUpperCase()}: Only supports "=" and "!=" operators for logical comparisons`)
            }
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope.toUpperCase()}: RegExp operands are not valid for logical comparisons`)
            }
            if (operand !== "true" && operand !== "false") {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be "true" or "false"`)
            }
        },
        isSize: (scope: string, operator: OperatorType, operand: string, operandType: OperandType) => {
            Mixin.VALIDATE.isComparable(scope, operator, operand, operandType)
            const units = [...Object.keys(Mixin.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const ok = new RegExp(`^\\d+(\\.\\d+)?(${units})$`, "i").test(operand)
            if (!ok) {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be a number followed by a unit: ${units}`)
            }
        },
        isNumber: (scope: string, operator: OperatorType, operand: string, operandType: OperandType) => {
            Mixin.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(Number(operand))) {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be a valid number`)
            }
        },
        isDate: (scope: string, operator: OperatorType, operand: string, operandType: OperandType) => {
            Mixin.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(new Date(operand).getTime())) {
                throw new Error(`In ${scope.toUpperCase()}: Operand must be a valid date string`)
            }
        },
    }

    static readonly CAST: Record<string, ICast> = {
        toStringOrRegexp: (operand: string, operandType: OperandType) => operandType === "REGEXP" ? new RegExp(operand) : operand.toString(),
        toNumber: (operand: string) => Number(operand),
        toBoolean: (operand: string) => operand.toLowerCase() === "true",
        toBytes: (operand: string) => {
            const units = [...Object.keys(Mixin.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const match = operand.match(/^(\d+(\.\d+)?)([a-z]+)$/i)
            if (!match) {
                throw new Error(`Operand must be a number followed by a unit: ${units}`)
            }
            const unit = match[3].toLowerCase() as UnitType
            if (!Mixin.UNITS.hasOwnProperty(unit)) {
                throw new Error(`Only supports unit: ${units}`)
            }
            return parseFloat(match[1]) * Mixin.UNITS[unit]
        },
        toDate: (operand: string) => truncateTime(operand),
    }

    static readonly MATCH: Record<string, IMatch> = {
        primitiveCompare: (scope: string, operator: OperatorType, operand: any, queryResult: any) => {
            return Mixin.OPERATOR[operator](queryResult, operand)
        },
        stringRegexp: (scope: string, operator: OperatorType, operand: RegExp, queryResult: string) => {
            return operand.test(queryResult.toString())
        },
        arrayCompare: (scope: string, operator: OperatorType, operand: any, queryResult: any[]) => {
            return queryResult.some(data => Mixin.OPERATOR[operator](data, operand))
        },
        arrayRegexp: (scope: string, operator: OperatorType, operand: RegExp, queryResult: string[]) => {
            return queryResult.some(data => operand.test(data))
        },
    }
}

function buildBaseQualifiers(): IQualifier[] {
    const QUERY: Record<string, IQuery> = {
        default: ({ path, file, stats, data }) => `${data.toString()}\n${path}`,
        path: ({ path, file, stats, data }) => path,
        file: ({ path, file, stats, data }) => file,
        ext: ({ path, file, stats, data }) => extname(file),
        content: ({ path, file, stats, data }) => data.toString(),
        time: ({ path, file, stats, data }) => truncateTime(stats.mtime),
        size: ({ path, file, stats, data }) => stats.size,
        linenum: ({ path, file, stats, data }) => data.toString().split("\n").length,
        charnum: ({ path, file, stats, data }) => data.toString().length,
        crlf: ({ path, file, stats, data }) => data.toString().includes("\r\n"),
        hasimage: ({ path, file, stats, data }) => /!\[.*?\]\(.*\)|<img.*?src=".*?"/.test(data.toString()),
        haschinese: ({ path, file, stats, data }) => /\p{sc=Han}/gu.test(data.toString()),
        line: ({ path, file, stats, data }) => data.toString().split("\n").map(e => e.trim()),
        chinesenum: ({ path, file, stats, data }) => {
            let count = 0
            for (const _ of data.toString().matchAll(/\p{sc=Han}/gu)) {
                count++
            }
            return count
        },
    }
    const qualifiers = [
        { scope: "default", name: "内容或路径", is_meta: false, query: QUERY.default },
        { scope: "path", name: "路径", is_meta: true, query: QUERY.path },
        { scope: "file", name: "文件名", is_meta: true, query: QUERY.file },
        { scope: "ext", name: "扩展名", is_meta: true, query: QUERY.ext },
        { scope: "content", name: "内容", is_meta: false, query: QUERY.content },
        { scope: "time", name: "修改时间", is_meta: true, query: QUERY.time, validate: Mixin.VALIDATE.isDate, cast: Mixin.CAST.toDate },
        { scope: "size", name: "文件大小", is_meta: true, query: QUERY.size, validate: Mixin.VALIDATE.isSize, cast: Mixin.CAST.toBytes },
        { scope: "linenum", name: "行数", is_meta: true, query: QUERY.linenum, validate: Mixin.VALIDATE.isNumber, cast: Mixin.CAST.toNumber },
        { scope: "charnum", name: "字符数", is_meta: true, query: QUERY.charnum, validate: Mixin.VALIDATE.isNumber, cast: Mixin.CAST.toNumber },
        { scope: "chinesenum", name: "中文字符数", is_meta: true, query: QUERY.chinesenum, validate: Mixin.VALIDATE.isNumber, cast: Mixin.CAST.toNumber },
        { scope: "crlf", name: "换行符为CRLF", is_meta: true, query: QUERY.crlf, validate: Mixin.VALIDATE.isBoolean, cast: Mixin.CAST.toBoolean },
        { scope: "hasimage", name: "包含图片", is_meta: true, query: QUERY.hasimage, validate: Mixin.VALIDATE.isBoolean, cast: Mixin.CAST.toBoolean },
        { scope: "haschinese", name: "包含中文字符", is_meta: true, query: QUERY.haschinese, validate: Mixin.VALIDATE.isBoolean, cast: Mixin.CAST.toBoolean },
        { scope: "line", name: "某行", is_meta: false, query: QUERY.line, match_keyword: Mixin.MATCH.arrayCompare, match_regexp: Mixin.MATCH.arrayRegexp },
    ]
    return qualifiers.map(setDefault)
}

interface IParser {
    (arg: string, options?: any): MarkdownIt.Token[]
}

interface IFilter {
    (node: MarkdownIt.Token): boolean
}

interface IFilterFactory {
    (...arg: any[]): IFilter
}

interface ITransformer {
    (node: MarkdownIt.Token): any
}

interface ITransformerFactory {
    (...arg: any[]): ITransformer
}

function cache(fn: IParser): IParser {
    let cached: string = ""
    let result: MarkdownIt.Token[] = []
    return (arg: string, options = {}) => {
        if (arg !== cached) {
            result = fn(arg, options)
            cached = arg
        }
        return result
    }
}

const markdownit = new MarkdownIT({ html: true, linkify: true, typographer: true })

const PARSER: Record<"block" | "inline", IParser> = {
    block: cache((content: string, options = {}) => markdownit.parse(content, options)),
    inline: cache((content: string, options = {}) => markdownit.parseInline(content, options)),
}

const FILTER_FACTORY: Record<string, IFilterFactory> = {
    is: type => node => node.type === type,
    wrappedBy: type => {
        const openType = `${type}_open`
        const closeType = `${type}_close`
        let balance = 0
        return node => {
            if (node.type === openType) {
                balance++
            } else if (node.type === closeType) {
                balance--
            }
            return balance > 0
        }
    },
    wrappedByTag: (type, tag) => {
        const openType = `${type}_open`
        const closeType = `${type}_close`
        let balance = 0
        return node => {
            if (node.type === openType && node.tag === tag) {
                balance++
            } else if (node.type === closeType && node.tag === tag) {
                balance--
            }
            return balance > 0
        }
    },
    wrappedByMulti: (...types) => {
        let wrapped = false
        const balances = new Uint8Array(types.length).fill(0)
        const flags = new Map(types.flatMap((type, idx) => [
            [`${type}_open`, [idx, 1]],
            [`${type}_close`, [idx, -1]],
        ]))
        return node => {
            const hit = flags.get(node.type)
            if (hit) {
                const [idx, value] = hit
                balances[idx] += value
                balances.fill(0, idx + 1)
                wrapped = balances.every(val => val > 0)
            }
            return wrapped
        }
    }
}

const TRANSFORMER: Record<string, ITransformer> = {
    content: node => node.content,
    info: node => node.info,
    infoAndContent: node => `${node.info} ${node.content}`,
    attrAndContent: node => {
        const attrs = node.attrs || []
        const attrContent = attrs.map(l => l[l.length - 1]).join(" ")
        return `${attrContent}${node.content}`
    },
    contentLine: node => node.content.split("\n"),
}

const TRANSFORMER_FACTORY: Record<string, ITransformerFactory> = {
    taskContent: (selectType = 0) => {
        const regexp = /^\[(x|X| )\]\s+(.+)/
        return node => {
            const content = node.content.trim()
            const hit = content.match(regexp)
            if (!hit) return ""
            const [_, selectText, taskText] = hit
            // 0:both, 1:selected, -1:unselected
            switch (selectType) {
                case 0:
                    return taskText
                case 1:
                    return (selectText === "x" || selectText === "X") ? taskText : ""
                case -1:
                    return selectText === " " ? taskText : ""
                default:
                    return ""
            }
        }
    },
    regexpContent: regexp => {
        return node => {
            const content = node.content.trim()
            const result = [...content.matchAll(regexp)]
            return result.map(([_, text]) => text).join(" ")
        }
    },
}

function buildMarkdownQualifiers(): IQualifier[] {
    const preorder = (ast: MarkdownIt.Token[] = [], filter: IFilter): MarkdownIt.Token[] => {
        const output: MarkdownIt.Token[] = []
        const recurse = (ast: MarkdownIt.Token[]) => {
            for (const node of ast) {
                if (filter(node)) {
                    output.push(node)
                }
                const children = node.children
                if (children && children.length) {
                    recurse(children)
                }
            }
        }
        recurse(ast)
        return output
    }
    const buildQuery = (parser: IParser, filter: IFilter, transformer: ITransformer): IQuery => {
        return source => {
            const content = source.data.toString()
            const ast = parser(content)
            const nodes = preorder(ast, filter)
            return nodes.flatMap(transformer).filter(Boolean)
        }
    }
    const buildQualifier = (scope: string, name: string, parser: IParser, filter: IFilter, transformer: ITransformer) => {
        const query = buildQuery(parser, filter, transformer)
        const is_meta = false
        const validate = Mixin.VALIDATE.isStringOrRegexp
        const cast = Mixin.CAST.toStringOrRegexp
        const match_keyword = Mixin.MATCH.arrayCompare
        const match_phrase = match_keyword
        const match_regexp = Mixin.MATCH.arrayRegexp
        return { scope, name, query, is_meta, validate, cast, match_keyword, match_phrase, match_regexp }
    }

    const qualifiers = [
        buildQualifier("blockcode", "代码块", PARSER.block, FILTER_FACTORY.is("fence"), TRANSFORMER.infoAndContent),
        buildQualifier("blockcodelang", "代码块语言", PARSER.block, FILTER_FACTORY.is("fence"), TRANSFORMER.info),
        buildQualifier("blockcodebody", "代码块内容", PARSER.block, FILTER_FACTORY.is("fence"), TRANSFORMER.content),
        buildQualifier("blockcodeline", "代码块的某行", PARSER.block, FILTER_FACTORY.is("fence"), TRANSFORMER.contentLine),
        buildQualifier("blockhtml", "HTML块", PARSER.block, FILTER_FACTORY.is("html_block"), TRANSFORMER.content),
        buildQualifier("blockquote", "引用块", PARSER.block, FILTER_FACTORY.wrappedBy("blockquote"), TRANSFORMER.content),
        buildQualifier("table", "表格", PARSER.block, FILTER_FACTORY.wrappedBy("table"), TRANSFORMER.content),
        buildQualifier("thead", "表格标题", PARSER.block, FILTER_FACTORY.wrappedBy("thead"), TRANSFORMER.content),
        buildQualifier("tbody", "表格正文", PARSER.block, FILTER_FACTORY.wrappedBy("tbody"), TRANSFORMER.content),
        buildQualifier("ol", "有序列表", PARSER.block, FILTER_FACTORY.wrappedBy("ordered_list"), TRANSFORMER.content),
        buildQualifier("ul", "无序列表", PARSER.block, FILTER_FACTORY.wrappedBy("bullet_list"), TRANSFORMER.content),
        buildQualifier("task", "任务列表", PARSER.block, FILTER_FACTORY.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER_FACTORY.taskContent(0)),
        buildQualifier("taskdone", "已完成任务", PARSER.block, FILTER_FACTORY.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER_FACTORY.taskContent(1)),
        buildQualifier("tasktodo", "未完成任务", PARSER.block, FILTER_FACTORY.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER_FACTORY.taskContent(-1)),
        buildQualifier("head", "标题", PARSER.block, FILTER_FACTORY.wrappedBy("heading"), TRANSFORMER.content),
        buildQualifier("h1", "一级标题", PARSER.block, FILTER_FACTORY.wrappedByTag("heading", "h1"), TRANSFORMER.content),
        buildQualifier("h2", "二级标题", PARSER.block, FILTER_FACTORY.wrappedByTag("heading", "h2"), TRANSFORMER.content),
        buildQualifier("h3", "三级标题", PARSER.block, FILTER_FACTORY.wrappedByTag("heading", "h3"), TRANSFORMER.content),
        buildQualifier("h4", "四级标题", PARSER.block, FILTER_FACTORY.wrappedByTag("heading", "h4"), TRANSFORMER.content),
        buildQualifier("h5", "五级标题", PARSER.block, FILTER_FACTORY.wrappedByTag("heading", "h5"), TRANSFORMER.content),
        buildQualifier("h6", "六级标题", PARSER.block, FILTER_FACTORY.wrappedByTag("heading", "h6"), TRANSFORMER.content),
        buildQualifier("highlight", "高亮文字", PARSER.block, FILTER_FACTORY.is("text"), TRANSFORMER_FACTORY.regexpContent(/==(.+)==/g)),
        buildQualifier("image", "图片", PARSER.inline, FILTER_FACTORY.is("image"), TRANSFORMER.attrAndContent),
        buildQualifier("code", "代码", PARSER.inline, FILTER_FACTORY.is("code_inline"), TRANSFORMER.content),
        buildQualifier("link", "链接", PARSER.inline, FILTER_FACTORY.wrappedBy("link"), TRANSFORMER.attrAndContent),
        buildQualifier("strong", "加粗文字", PARSER.inline, FILTER_FACTORY.wrappedBy("strong"), TRANSFORMER.content),
        buildQualifier("em", "斜体文字", PARSER.inline, FILTER_FACTORY.wrappedBy("em"), TRANSFORMER.content),
        buildQualifier("del", "删除线文字", PARSER.inline, FILTER_FACTORY.wrappedBy("s"), TRANSFORMER.content),
    ]
    return qualifiers.map(setDefault)
}

const getDefaultQualifiers = (): IQualifier[] => {
    return [...buildBaseQualifiers(), ...buildMarkdownQualifiers()]
}

export { Mixin, PARSER as MarkdownParser, getDefaultQualifiers, IQualifier, OperatorType }
