import { GluegunToolbox } from 'gluegun'
import * as path from 'path'
import * as fs from 'fs'
import * as ejs from 'ejs'
import * as prettier from 'prettier'

export default {
    name: 'generate-entity-new',
    alias: ['gen'],
    description: 'Gerar arquivos necessários para uma entidade a partir de um array de propriedades',
    run: async (toolbox: GluegunToolbox) => {
        const { print, parameters } = toolbox
        const isTenant = parameters.first === 't' || parameters.first === 'tenant'
        const cwd = process.cwd()

        try {
            const httpModuleFilePath = path.join(cwd, 'src', 'infra', 'http', 'http.module.ts')
            const databaseModuleFilePath = path.join(cwd, 'src', 'infra', 'database', 'database.module.ts')
            const entities = await generateProperties()
            for (const entity of entities) {
                const entityName = toSnakeCase(entity.name)
                const nameTitleCase = toTitleCase(entity.name)
                const entityNameCamelCase = toCamelCase(entity.name)
                const entityNameArquivoCase = toArquivoCase(entity.name)

                if (!entityName) {
                    print.error('Por favor, forneça um nome para a entidade.')
                    continue
                }

                const paths = {
                    entities: path.join(cwd, 'src', 'infra', 'database', 'typeorm', 'entities', isTenant ? 'tenanted' : ''),
                    repositories: path.join(cwd, 'src', 'infra', 'database', 'typeorm', 'repositories', isTenant ? 'tenanted' : ''),
                    repositoryInterfaces: path.join(cwd, 'src', 'domain', 'repositories', isTenant ? 'tenanted' : ''),
                    models: path.join(cwd, 'src', 'domain', 'models', isTenant ? 'tenanted' : ''),
                    useCases: path.join(cwd, 'src', 'application', 'use-cases', entityNameArquivoCase),
                    dtos: path.join(cwd, 'src', 'infra', 'http', 'dtos'),
                    viewModels: path.join(cwd, 'src', 'infra', 'http', 'view-models'),
                    controllers: path.join(cwd, 'src', 'infra', 'http', 'controllers'),
                }

                const entityFilePath = path.join(paths.entities, `${entityNameArquivoCase}.entity.ts`)
                const repositoryInterfacePath = path.join(paths.repositoryInterfaces, `${entityNameArquivoCase}-repository.ts`)

                if (fs.existsSync(entityFilePath) || fs.existsSync(repositoryInterfacePath)) {
                    print.error('Entidade ou repositório com este nome já existe.')
                    continue
                }

                entity.props = typeTransform(entity.props)

                const relationshipsCode = generateRelationshipsCode(entity.relationships || [], entity)
                const templateData = {
                    entityName,
                    entityNameTitleCase: nameTitleCase,
                    entityNameCamelCase,
                    entityNameArquivoCase,
                    entityNameLowerCase: entityName.toLowerCase(),
                    properties: entity.props,
                    relationships: entity.relationships || [],
                    propsCode: generatePropsCode(entity.props),
                    relationshipsCode: relationshipsCode,
                    relationshipsImports: Array.from(
                        new Set(
                            (entity.relationships || []).map(
                                (rel) => `import { ${toTitleCase(rel.entity)}Entity } from './${toArquivoCase(rel.entity)}.entity';`
                            )
                        )
                    ).join('\n'),
                    is_tenant: isTenant,
                }
                const generatedCode = `
                import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, ManyToOne,OneToOne, OneToMany, JoinTable, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
                ${templateData.relationshipsImports}
                @Entity('${entityName}')
                export class ${templateData.entityNameTitleCase}Entity {
                  @PrimaryGeneratedColumn()
                  ${templateData.entityNameLowerCase}_id: number;

                  ${templateData.propsCode}

                  ${relationshipsCode}

                  @CreateDateColumn()
                    createdAt: Date;

                    @UpdateDateColumn()
                    updatedAt: Date;

                    @DeleteDateColumn({ default: null })
                    deletedAt: Date;
                }
                `
                const entityContent = generatedCode
                fs.writeFileSync(entityFilePath, entityContent)
                await prettifyFile(entityFilePath)
                // Gerar arquivos principais
                // await generateFile(entityFilePath, 'entity.ejs', templateData)
                await generateFile(path.join(paths.models, `${entityNameArquivoCase}.ts`), 'model.ejs', templateData)
                await generateFile(repositoryInterfacePath, 'repository-interface.ejs', templateData)
                await generateFile(path.join(paths.repositories, `${entityNameArquivoCase}-repository.ts`), 'repository-class.ejs', templateData)

                // Gerar DTOs
                await generateFile(path.join(paths.dtos, `create-${entityNameArquivoCase}-body.ts`), 'dto-create-body.ejs', templateData)
                await generateFile(path.join(paths.dtos, `update-${entityNameArquivoCase}-body.ts`), 'dto-update-body.ejs', templateData)

                await generateFile(path.join(paths.viewModels, `${entityNameArquivoCase}-view-model.ts`), 'view-model.ejs', templateData)
                // Gerar Use Cases
                if (!fs.existsSync(paths.useCases)) fs.mkdirSync(paths.useCases, { recursive: true })
                const useCases = ['create', 'update', 'find', 'find-many', 'delete']
                for (const action of useCases) {
                    await generateFile(path.join(paths.useCases, `${action}-${entityNameArquivoCase}.ts`), `useCase-${action}.ejs`, templateData)
                }

                // Gerar Controller
                await generateFile(path.join(paths.controllers, `${entityNameArquivoCase}.controller.ts`), 'controller.ejs', templateData)

                // Atualizar o arquivo do módulo
                await updateHttpModule(entityName, entityNameArquivoCase, nameTitleCase)
                await updateDatabaseModule(entityName, entityNameArquivoCase, nameTitleCase, isTenant)

                print.success(`Arquivos para "${entityName}" criados com sucesso.`)
            }
            // Formatar o arquivo com Prettier
            await prettifyFile(httpModuleFilePath)
            await prettifyFile(databaseModuleFilePath)
        } catch (error) {
            print.error(`Erro ao gerar entidades: ${error.message}`)
        }
    },
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

async function generateFile(filePath: string, templateName: string, data: any) {
    const templatePath = path.join(__dirname, '..', 'src', 'templates', templateName)
    const content = await ejs.renderFile(templatePath, data)
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

async function generateProperties() {
    type DecimalFormatString = `${number},${number}`
    const props = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'newEntityProp.json'), 'utf-8')) as {
        name: string
        props: {
            prop: string
            type: string
            required?: boolean
            default?: any
            decimal_format_db?: DecimalFormatString
            adicionalOptions?: string
        }[]
        relationships?: {
            name: string
            type: string
            entity: string
        }[]
    }[]
    return props
}

function toTitleCase(input: string): string {
    let words = String(input)
        .trim()
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ') // Remover espaços extras
        .split(' ')

    return words.map((word) => capitalize(word)).join('')
    // .replace(/(?:^|\s)\S/g, (match) => match.toUpperCase()) // Converter a primeira letra de cada palavra em maiúscula
}
function toCamelCase(input: string): string {
    const words = String(input).trim().replace(/[_-]/g, ' ').toLowerCase().split(/\s+/) // Dividir a string em palavras
    const firstWord = words.shift() || '' // Remover a primeira palavra e obtê-la
    const camelCasedWords = words.map((word) => capitalize(word)) // Capitalizar cada palavra, exceto a primeira
    return firstWord.toLowerCase() + camelCasedWords.join('')
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}
function toSnakeCase(input: string): string {
    return String(input)
        .trim()
        .replace(/[_-]/g, '_')
        .replace(/\s+/g, '_') // Substituir espaços por _
        .replace(/([a-z])([A-Z])/g, '$1_$2') // Adicionar _ entre letras minúsculas e maiúsculas adjacentes
        .toLowerCase() // Converter tudo para minúsculas
}
function toArquivoCase(input: string): string {
    return String(input)
        .trim()
        .replace(/[_-]/g, '-')
        .replace(/\s+/g, '-') // Substituir espaços por _
        .replace(/([a-z])([A-Z])/g, '$1-$2') // Adicionar _ entre letras minúsculas e maiúsculas adjacentes
        .toLowerCase() // Converter tudo para minúsculas
}

function generatePropsCode(props: any[]) {
    return props
        .map((prop) => {
            let propCode = '@Column()'
            const columnOptions: Record<string, any> = {}

            if (prop.type === 'string') propCode += `\n  ${prop.prop}: string;`
            else if (['number', 'float', 'double'].includes(prop.type)) propCode += `\n  ${prop.prop}: ${prop.typeTransform};`
            else if (['boolean', 'bool', 'int'].includes(prop.type)) propCode += `\n  ${prop.prop}: ${prop.typeTransform};`
            else if (prop.type === 'Date' || prop.type === 'date') propCode += `\n  ${prop.prop}: ${prop.typeTransform};`
            else if (prop.type === 'json') {
                propCode += `\n  ${prop.prop}: ${prop.typeTransform};`
                columnOptions.type = 'json'
            } else propCode += `\n  ${prop.prop}: ${prop.typeTransform};`

            if (prop.required) {
                columnOptions.nullable = false
            } else {
                columnOptions.nullable = true
            }

            if (prop.default !== undefined) {
                columnOptions.default = prop.default === 'new_date' ? 'CURRENT_TIMESTAMP' : prop.default
            }

            if (prop.adicionalOptions) {
                try {
                    const parsed = eval('({' + prop.adicionalOptions.replace(/{|}/g, '') + '})')
                    Object.assign(columnOptions, parsed)
                } catch {
                    // Se falhar, ignora
                }
            }

            if (prop.decimal_format_db) {
                const [precision, scale] = prop.decimal_format_db.split(',')
                columnOptions.type = 'decimal'
                columnOptions.precision = Number(precision)
                columnOptions.scale = Number(scale)
            }

            const optionsString = Object.keys(columnOptions).length
                ? `{ ${Object.entries(columnOptions)
                      .map(([k, v]) =>
                          typeof v === 'string' ? `${k}: '${v}'` : typeof v === 'function' ? `${k}: ${v.toString()}` : `${k}: ${JSON.stringify(v)}`
                      )
                      .join(', ')} }`
                : ''

            if (optionsString) propCode = `@Column(${optionsString})\n  ${propCode.replace('@Column()', '')}`

            return propCode
        })
        .join('\n\n')
}

function generateRelationshipsCode(relationships: any[], entityData: any) {
    return relationships
        .map((relationship) => {
            let relCode = ''

            if (relationship.type === 'many-to-many') {
                relCode = `@ManyToMany(type => ${toTitleCase(relationship.entity)}Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(
                    relationship.entity
                )})`

                // if (relationship.joinTable) {
                relCode += `\n  @JoinTable({\n`
                relCode += `    name: '${toSnakeCase(entityData.name)}_${toSnakeCase(relationship.entity)}',\n`
                relCode += `    joinColumn: {\n`
                relCode += `        name: '${toSnakeCase(entityData.name)}_id',\n`
                relCode += `        referencedColumnName: '${toSnakeCase(entityData.name)}_id',\n`
                relCode += `    },\n`
                relCode += `    inverseJoinColumn: {\n`
                relCode += `        name: '${toSnakeCase(relationship.entity)}_id',\n`
                relCode += `        referencedColumnName: '${toSnakeCase(relationship.entity)}_id',\n`
                relCode += `    },\n`
                relCode += `  })`
                // }

                relCode += `\n  ${relationship.name}: ${toTitleCase(relationship.entity)}Entity[];`
            } else if (relationship.type === 'many-to-one') {
                //   relCode = `@ManyToOne(type => ${
                //     toTitleCase(relationship.entity)
                //   }Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(relationship.entity)}.${entityData.name.toLowerCase()}s)\n  ${
                //     relationship.name
                //   }: ${toTitleCase(relationship.entity)}Entity;`;
                relCode = `@ManyToOne(type => ${toTitleCase(relationship.entity)}Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(
                    relationship.entity
                )})\n
        @JoinColumn({ name: '${toSnakeCase(relationship.name)}_id' }) \n
        ${relationship.name}: ${toTitleCase(relationship.entity)}Entity;`
            } else if (relationship.type === 'one-to-many') {
                relCode = `@OneToMany(type => ${toTitleCase(relationship.entity)}Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(
                    relationship.entity
                )})\n  ${relationship.name}: ${toTitleCase(relationship.entity)}Entity[];`
            } else if (relationship.type === 'one-to-one') {
                relCode = `@OneToOne(type => ${toTitleCase(relationship.entity)}Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(
                    relationship.entity
                )})\n  ${relationship.name}: ${toTitleCase(relationship.entity)}Entity;`
            }

            return relCode
        })
        .join('\n\n')
}

async function updateHttpModule(entityName: string, entityNameArquivoCase: string, nameTitleCase: string) {
    const httpModuleFilePath = path.join(process.cwd(), 'src', 'infra', 'http', 'http.module.ts') // Path to HttpModule

    if (!fs.existsSync(httpModuleFilePath)) {
        console.error(`HttpModule file not found: ${httpModuleFilePath}`)
        return
    }

    const moduleContent = fs.readFileSync(httpModuleFilePath, 'utf-8')

    // Generate imports
    const controllerImport = `import { ${nameTitleCase}Controller } from './controllers/${entityNameArquivoCase}.controller';`
    const useCaseImports = `
import { Create${nameTitleCase} } from '../../application/use-cases/${entityNameArquivoCase}/create-${entityNameArquivoCase}';
import { Update${nameTitleCase} } from '../../application/use-cases/${entityNameArquivoCase}/update-${entityNameArquivoCase}';
import { Find${nameTitleCase} } from '../../application/use-cases/${entityNameArquivoCase}/find-${entityNameArquivoCase}';
import { FindMany${nameTitleCase} } from '../../application/use-cases/${entityNameArquivoCase}/find-many-${entityNameArquivoCase}';
import { Delete${nameTitleCase} } from '../../application/use-cases/${entityNameArquivoCase}/delete-${entityNameArquivoCase}';
`

    // Generate use cases constant
    const useCasesDeclaration = `const useCases${nameTitleCase} = [
    Create${nameTitleCase},
    Update${nameTitleCase},
    Find${nameTitleCase},
    FindMany${nameTitleCase},
    Delete${nameTitleCase},
];`

    // Ensure imports are at the top
    let updatedContent = moduleContent
    if (!moduleContent.includes(controllerImport)) {
        updatedContent = `${controllerImport}\n${updatedContent}`
    }
    if (!moduleContent.includes(`Create${nameTitleCase}`)) {
        updatedContent = `${useCaseImports}\n${updatedContent}`
    }

    // Ensure use cases constant is declared after imports but before the module definition
    const moduleStartIndex = updatedContent.indexOf('@Module')
    if (!moduleContent.includes(`const useCases${nameTitleCase}`)) {
        const importsEndIndex = updatedContent.lastIndexOf('import', moduleStartIndex)
        const nextLineIndex = updatedContent.indexOf('\n', importsEndIndex) + 1
        updatedContent = updatedContent.slice(0, nextLineIndex) + `\n${useCasesDeclaration}\n` + updatedContent.slice(nextLineIndex)
    }

    // Add controller and providers to the module
    const controllerRegex = /controllers:\s*\[([^\]]*)\]/
    const providerRegex = /providers:\s*\[([^\]]*)\]/

    if (controllerRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(controllerRegex, (match, p1) => {
            const controllers = p1
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            return `controllers: [${Array.from(new Set([...controllers, `${nameTitleCase}Controller`])).join(', ')}]`
        })
    }

    if (providerRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(providerRegex, (match, p1) => {
            const providers = p1
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            return `providers: [${Array.from(new Set([...providers, `...useCases${nameTitleCase}`])).join(', ')}]`
        })
    }

    // Save the updated file
    fs.writeFileSync(httpModuleFilePath, updatedContent, 'utf-8')
    console.log(`HttpModule updated successfully: ${httpModuleFilePath}`)
}

async function updateDatabaseModule(entityName: string, entityNameArquivoCase: string, nameTitleCase: string, isTenant: boolean) {
    const databaseModuleFilePath = path.join(process.cwd(), 'src', 'infra', 'database', 'database.module.ts') // Caminho do DatabaseModule

    if (!fs.existsSync(databaseModuleFilePath)) {
        console.error(`Arquivo DatabaseModule não encontrado: ${databaseModuleFilePath}`)
        return
    }

    const moduleContent = fs.readFileSync(databaseModuleFilePath, 'utf-8')

    // Adicionar os imports
    const repositoryInterfaceImport = `import { I${nameTitleCase}Repository } from '../../domain/repositories/${
        isTenant ? 'tenanted/' : ''
    }${entityNameArquivoCase}-repository';`
    const repositoryClassImport = `import { ${nameTitleCase}Repository } from './typeorm/repositories/${
        isTenant ? 'tenanted/' : ''
    }${entityNameArquivoCase}-repository';`
    const entityImport = `import { ${nameTitleCase}Entity } from './typeorm/entities/${isTenant ? 'tenanted/' : ''}${entityNameArquivoCase}.entity';`

    // Criar o provider para inversão de dependência
    const providerDeclaration = `{
        provide: I${nameTitleCase}Repository,
        useClass: ${nameTitleCase}Repository,
    }`

    // Adicionar os imports ao início do arquivo
    let updatedContent = moduleContent
    if (!moduleContent.includes(repositoryInterfaceImport)) {
        updatedContent = `${repositoryInterfaceImport}\n${updatedContent}`
    }
    if (!moduleContent.includes(repositoryClassImport)) {
        updatedContent = `${repositoryClassImport}\n${updatedContent}`
    }
    if (!moduleContent.includes(entityImport)) {
        updatedContent = `${entityImport}\n${updatedContent}`
    }

    // Adicionar a entidade ao TypeOrmModule.forFeature
    const typeOrmFeatureRegex = /TypeOrmModule\.forFeature\(\[([^\]]*)\]\)/
    if (typeOrmFeatureRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(typeOrmFeatureRegex, (match, p1) => {
            const cleanedFeatures = p1
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
                .join(', ')
            return `TypeOrmModule.forFeature([${cleanedFeatures}${cleanedFeatures ? ', ' : ''}${nameTitleCase}Entity])`
        })
    }

    // Adicionar o provider e exportar a interface
    const providerRegex = /providers:\s*\[([^\]]*)\]/
    const exportRegex = /exports:\s*\[([^\]]*)\]/

    if (providerRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(providerRegex, (match, p1) => {
            const cleanedProviders = p1
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
                .join(', ')
            return `providers: [${cleanedProviders}${cleanedProviders ? ', ' : ''}${providerDeclaration}]`
        })
    }

    if (exportRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(exportRegex, (match, p1) => {
            const cleanedExports = p1
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
                .join(', ')
            return `exports: [${cleanedExports}${cleanedExports ? ', ' : ''}I${nameTitleCase}Repository]`
        })
    }

    // Salvar o arquivo atualizado
    fs.writeFileSync(databaseModuleFilePath, updatedContent, 'utf-8')
    console.log(`DatabaseModule atualizado com sucesso: ${databaseModuleFilePath}`)
}
