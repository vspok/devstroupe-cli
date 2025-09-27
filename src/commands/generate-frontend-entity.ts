import { GluegunToolbox } from 'gluegun'
import * as path from 'path'
import * as fs from 'fs'
import * as ejs from 'ejs'
import * as prettier from 'prettier'

export default {
    name: 'generate-frontend-entity',
    alias: ['gfe'],
    description: 'Gerar arquivos necessários para o frontend a partir de uma entidade',
    run: async (toolbox: GluegunToolbox) => {
        const { print } = toolbox
        const cwd = process.cwd()

        try {
            const entities = await generateProperties()
            for (const entity of entities) {
                entity.props = typeTransform(entity.props)
                const entityName = toSnakeCase(entity.name)
                const nameTitleCase = toTitleCase(entity.name)
                const entityNameCamelCase = toCamelCase(entity.name)
                const entityNameArquivoCase = toArquivoCase(entity.name)

                if (!entityName) {
                    print.error('Por favor, forneça um nome para a entidade.')
                    continue
                }

                const paths = {
                    components: path.join(cwd, 'src', 'app', 'modules', entityNameArquivoCase),
                    services: path.join(cwd, 'src', 'app', 'services'),
                    models: path.join(cwd, 'src', 'app', 'models'),
                }

                // Ensure directories exist
                if (!fs.existsSync(paths.components)) {
                    fs.mkdirSync(paths.components, { recursive: true })
                }
                if (!fs.existsSync(path.join(paths.components, 'list'))) {
                    fs.mkdirSync(path.join(paths.components, 'list'), { recursive: true })
                }
                if (!fs.existsSync(path.join(paths.components, 'form'))) {
                    fs.mkdirSync(path.join(paths.components, 'form'), { recursive: true })
                }
                if (!fs.existsSync(paths.services)) {
                    fs.mkdirSync(paths.services, { recursive: true })
                }
                if (!fs.existsSync(paths.models)) {
                    fs.mkdirSync(paths.models, { recursive: true })
                }

                // Calcular relacionamentos únicos
                const uniqueServices = new Map()
                const relationshipsUniques = []

                if (entity.relationships) {
                    entity.relationships.forEach((rel) => {
                        if (!uniqueServices.has(rel.entity)) {
                            uniqueServices.set(rel.entity, rel.name)
                            relationshipsUniques.push(rel)
                        }
                    })
                }

                // Gerar arquivos do frontend
                const templateData = {
                    entityName,
                    entityNameTitleCase: nameTitleCase,
                    entityNameCamelCase,
                    entityNameArquivoCase,
                    properties: entity.props,
                    relationships: entity.relationships || [],
                    relationshipsUniques,
                    label: entity.label,
                    description: entity.description,
                }

                // Gerar modelo
                await generateFile(path.join(paths.models, `${entityNameArquivoCase}.model.ts`), 'angular/frontend-model.ejs', templateData)

                // Gerar serviço
                await generateFile(path.join(paths.services, `${entityNameArquivoCase}.service.ts`), 'angular/frontend-service.ejs', templateData)

                // Gerar componente TypeScript
                await generateFile(
                    path.join(paths.components, 'list', `${entityNameArquivoCase}-list.component.ts`),
                    'angular/frontend-list-component.ejs',
                    templateData
                )

                await generateFile(
                    path.join(paths.components, 'form', `${entityNameArquivoCase}-form.component.ts`),
                    'angular/frontend-form-component.ejs',
                    templateData
                )

                // Gerar componente HTML
                await generateFile(
                    path.join(paths.components, 'list', `${entityNameArquivoCase}-list.component.html`),
                    'angular/frontend-list-component-html.ejs',
                    templateData
                )

                await generateFile(
                    path.join(paths.components, 'form', `${entityNameArquivoCase}-form.component.html`),
                    'angular/frontend-form-component-html.ejs',
                    templateData
                )

                await generateFile(path.join(paths.components, `${entityNameArquivoCase}.routes.ts`), 'angular/frontend-routes.ejs', templateData)

                print.success(`Arquivos para "${entityName}" gerados com sucesso no frontend.`)
            }
        } catch (error) {
            print.error(`Erro ao gerar arquivos do frontend: ${error.message}`)
        }
    },
}

async function generateFile(filePath: string, templateName: string, data: any) {
    const templatePath = path.join(__dirname, '..', 'src', 'templates', templateName)
    const content = await ejs.renderFile(templatePath, {
        ...data,
        toTitleCase,
        toArquivoCase,
    })
    fs.writeFileSync(filePath, content)
    await prettifyFile(filePath)
}

async function prettifyFile(filePath: string) {
    const options = await prettier.resolveConfig(process.cwd())
    if (!options) return
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const formattedContent = prettier.format(fileContent, { ...options, filepath: filePath })
    fs.writeFileSync(filePath, formattedContent)
}
const typeTransform = (props: any[]) => {
    return props.map((prop) => {
        if (prop.type === 'string') {
            prop.typeTransform = 'string'
        } else if (['number', 'float', 'double'].includes(prop.type)) {
            prop.typeTransform = 'number'
        } else if (['boolean', 'bool', 'int'].includes(prop.type)) {
            prop.typeTransform = 'boolean'
        } else if (prop.type === 'Date' || prop.type === 'date') {
            prop.typeTransform = 'Date'
        } else if (prop.type === 'json') {
            prop.typeTransform = 'any'
        } else {
            prop.typeTransform = 'string'
        }
        return prop
    })
}
async function generateProperties() {
    const props = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'newEntityProp.json'), 'utf-8'))
    type DecimalFormatString = `${number},${number}`

    return props as {
        name: string
        label?: string
        description?: string
        props: {
            prop: string
            type: string
            required?: boolean
            default?: any
            decimal_format_db?: DecimalFormatString
            adicionalOptions?: string
            label?: string
            ignoreInForm?: boolean
        }[]
        relationships?: {
            name: string
            type: string
            entity: string
            displayProperty?: string
        }[]
    }[]
}

function toTitleCase(input: string): string {
    return input
        .replace(/_/g, ' ')
        .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
        .replace(/\s+/g, '')
}

function toCamelCase(input: string): string {
    return input.replace(/_./g, (match) => match.charAt(1).toUpperCase()).replace(/^\w/, (match) => match.toLowerCase())
}

function toSnakeCase(input: string): string {
    return input.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

function toArquivoCase(input: string): string {
    return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
