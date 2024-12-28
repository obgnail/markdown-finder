import { Stats as FsStats } from "fs"
import { readdir, stat, readFile } from "fs/promises"
import { join, extname } from "path"

type FilterFunc = (file: string, path: string, stats?: FsStats) => boolean
type FilterFactory = (...args: any[]) => FilterFunc

const Filter: Record<string, FilterFactory> = {
    hidden: () => {
        return (file: string) => !file.startsWith(".")
    },
    size: (max: number = 10 * (1 << 20)) => {
        return (file: string, path?: string, stats?: FsStats) => {
            return stats ? stats.size < max : false
        }
    },
    ext: (allow: string[] = ["", "md", "markdown", "mdown", "mmd", "text", "txt", "rmarkdown", "mkd", "mdwn", "mdtxt", "rmd", "mdtext", "apib"]) => {
        const allowed = new Set(allow.map(ext => ext.toLowerCase()))
        return (file: string) => {
            const ext = extname(file).toLowerCase()
            const extension = ext.startsWith(".") ? ext.slice(1) : ext
            return allowed.has(extension)
        }
    },
    name: (exclude: string[] = [".git", "node_modules"]) => {
        return (file: string) => !exclude.includes(file)
    },
}

type TraverseResult = {
    path: string
    file: string
    stats: FsStats
    data: Buffer
}

async function* genTraverser(
    dir: string,
    fileFilters: FilterFunc[] = [Filter.hidden(), Filter.size(), Filter.ext()],
    dirFilters: FilterFunc[] = [Filter.hidden(), Filter.name()],
): AsyncGenerator<TraverseResult> {
    async function* traverse(dir: string): AsyncGenerator<TraverseResult> {
        const files = await readdir(dir)
        for (const file of files) {
            const path = join(dir, file)
            const stats = await stat(path)
            if (stats.isFile()) {
                if (fileFilters.every(fn => fn(file, path, stats))) {
                    const data = await readFile(path)
                    yield { path, file, stats, data }
                }
            } else if (stats.isDirectory()) {
                if (dirFilters.every(fn => fn(file, path))) {
                    yield* traverse(path)
                }
            }
        }
    }

    yield* traverse(dir)
}

export { genTraverser, Filter, TraverseResult, FilterFunc }
