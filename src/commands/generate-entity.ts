// src/cli/generate-entity.ts

import { GluegunToolbox } from 'gluegun'
import * as path from 'path'
import * as fs from 'fs'
import * as ejs from 'ejs'
import * as prettier from 'prettier'

export default {
    name: 'generate-entity',
    alias: ['ge'],
    description: 'Gerar arquivos nessesario pra uma entidade apartir de um array de propredades',
    run: async (toolbox: GluegunToolbox) => {
        const {
            parameters,
            print,
            print: { error, success },
            filesystem,
        } = toolbox

        // Check if the entity name is provided
        const entityName = toSnakeCase(parameters.first)
        // Convert entity name to title case
        const nameTitleCase = toTitleCase(parameters.first)
        const entityNameCamelCase = toCamelCase(parameters.first)
        const entityNameArquivoCase = toArquivoCase(parameters.first)

        if (!entityName) {
            print.error('Please provide a name for the entity.')
            return
        }
        //paths cwd
        const cwd = process.cwd()
        const entitiesFolderPath = path.join(cwd, 'src', 'infra', 'database', 'typeorm', 'entities')
        const repositoriesFolderPath = path.join(cwd, 'src', 'infra', 'database', 'typeorm', 'repositories')
        const repositoriesInterfaceFolderPath = path.join(cwd, 'src', 'domain', 'repositories')
        const modelsFolderPath = path.join(cwd, 'src', 'domain', 'models')
        const mappersFolderPath = path.join(cwd, 'src', 'infra', 'database', 'typeorm', 'mappers')
        const useCaseFolderPath = path.join(cwd, 'src', 'application', 'use-cases', entityNameArquivoCase)
        const databaseModuleFilePath = path.join(cwd, 'src', 'infra', 'database', 'database.module.ts')
        const httpModuleFilePath = path.join(cwd, 'src', 'infra', 'http', 'http.module.ts')
        const controllerFilePath = path.join(cwd, 'src', 'infra', 'http', 'controllers')
        const viewModelFilePath = path.join(cwd, 'src', 'infra', 'http', 'view-models')
        const dtosFilePath = path.join(cwd, 'src', 'infra', 'http', 'dtos')

        const entityFilePath = path.join(entitiesFolderPath, `${entityNameArquivoCase}.entity.ts`)
        const repositoryFilePath = path.join(repositoriesInterfaceFolderPath, `${entityNameArquivoCase}-repository.ts`)

        // Check if entity or repository with the same name already exists
        if (fs.existsSync(entityFilePath) || fs.existsSync(repositoryFilePath)) {
            print.error('Entity or repository with this name already exists.')
            return
        }

        // Generate entity properties
        const entityProperties = (await generateProperties()).map((prop) => {
            return {
                ...prop,
                default: prop.default !== '' ? prop.default : undefined,
                required: prop.required ? true : false,
            }
        })

        // Template EJS data
        const templateData = {
            entityName: entityName,
            entityNameTitleCase: nameTitleCase,
            entityNameCamelCase: entityNameCamelCase,
            entityNameArquivoCase: entityNameArquivoCase,
            entityNameLowerCase: entityName.toLowerCase(),
            properties: entityProperties, // Function to generate properties string
        }

        // Render Entity Template
        const entityTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'entity.ejs')
        const entityContent = await ejs.renderFile(entityTemplatePath, templateData)

        // Write entity file
        fs.writeFileSync(entityFilePath, entityContent)
        await prettifyFile(entityFilePath)

        // Create model file
        const modelTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'model.ejs')
        const modelContent = await ejs.renderFile(modelTemplatePath, templateData)
        const modelFilePath = path.join(modelsFolderPath, `${entityNameArquivoCase}.ts`)
        fs.writeFileSync(modelFilePath, modelContent)
        await prettifyFile(modelFilePath)

        // Create repository interface file
        const repositoryInterfaceTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'repository-interface.ejs')
        const repositoryInterfaceContent = await ejs.renderFile(repositoryInterfaceTemplatePath, templateData)
        const repositoryInterfaceFilePath = path.join(repositoriesInterfaceFolderPath, `${entityNameArquivoCase}-repository.ts`)
        fs.writeFileSync(repositoryInterfaceFilePath, repositoryInterfaceContent)
        await prettifyFile(repositoryInterfaceFilePath)

        // Create repository class file
        const repositoryClassTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'repository-class.ejs')
        const repositoryClassContent = await ejs.renderFile(repositoryClassTemplatePath, templateData)
        const repositoryClassFilePath = path.join(repositoriesFolderPath, `${entityNameArquivoCase}-repository.ts`)
        fs.writeFileSync(repositoryClassFilePath, repositoryClassContent)
        await prettifyFile(repositoryClassFilePath)

        // Create mappers class file

        const mapperTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'mapper.ejs')
        const mapperContent = await ejs.renderFile(mapperTemplatePath, templateData)
        const mapperFilePath = path.join(mappersFolderPath, `${entityNameArquivoCase}-mapper.ts`)
        fs.writeFileSync(mapperFilePath, mapperContent)
        await prettifyFile(mapperFilePath)

        // Create USECASES class file
        if (!fs.existsSync(useCaseFolderPath)) {
            fs.mkdirSync(useCaseFolderPath, { recursive: true })
        }
        // CREATE
        const useCaseCREATETemplatePath = path.join(__dirname, '..', 'src', 'templates', 'useCase-create.ejs')
        const useCaseCREATEContent = await ejs.renderFile(useCaseCREATETemplatePath, templateData)
        const useCaseCREATEFilePath = path.join(useCaseFolderPath, `create-${entityNameArquivoCase}.ts`)
        fs.writeFileSync(useCaseCREATEFilePath, useCaseCREATEContent)
        await prettifyFile(useCaseCREATEFilePath)
        //UPDATE
        const useCaseUPDATETemplatePath = path.join(__dirname, '..', 'src', 'templates', 'useCase-update.ejs')
        const useCaseUPDATEContent = await ejs.renderFile(useCaseUPDATETemplatePath, templateData)
        const useCaseUPDATEFilePath = path.join(useCaseFolderPath, `update-${entityNameArquivoCase}.ts`)
        fs.writeFileSync(useCaseUPDATEFilePath, useCaseUPDATEContent)
        await prettifyFile(useCaseUPDATEFilePath)
        //FIND
        const useCaseFINDTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'useCase-find.ejs')
        const useCaseFINDContent = await ejs.renderFile(useCaseFINDTemplatePath, templateData)
        const useCaseFINDFilePath = path.join(useCaseFolderPath, `find-${entityNameArquivoCase}.ts`)
        fs.writeFileSync(useCaseFINDFilePath, useCaseFINDContent)
        await prettifyFile(useCaseFINDFilePath)
        //FIND-MANY
        const useCaseFINDMANYTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'useCase-find-many.ejs')
        const useCaseFINDMANYContent = await ejs.renderFile(useCaseFINDMANYTemplatePath, templateData)
        const useCaseFINDMANYFilePath = path.join(useCaseFolderPath, `find-many-${entityNameArquivoCase}.ts`)
        fs.writeFileSync(useCaseFINDMANYFilePath, useCaseFINDMANYContent)
        await prettifyFile(useCaseFINDMANYFilePath)
        //DELETE
        const useCaseDELETETemplatePath = path.join(__dirname, '..', 'src', 'templates', 'useCase-delete.ejs')
        const useCaseDELETEContent = await ejs.renderFile(useCaseDELETETemplatePath, templateData)
        const useCaseDELETEFilePath = path.join(useCaseFolderPath, `delete-${entityNameArquivoCase}.ts`)
        fs.writeFileSync(useCaseDELETEFilePath, useCaseDELETEContent)
        await prettifyFile(useCaseDELETEFilePath)
        //CONTROLLER
        const ControllerTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'controller.ejs')
        const ControllerContent = await ejs.renderFile(ControllerTemplatePath, templateData)
        const ControllerPath = path.join(controllerFilePath, `${entityNameArquivoCase}.controller.ts`)
        fs.writeFileSync(ControllerPath, ControllerContent)
        await prettifyFile(ControllerPath)
        //DTOS
        const createDtoTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'dto-create-body.ejs')
        const createDtoContent = await ejs.renderFile(createDtoTemplatePath, templateData)
        const createDtoPath = path.join(dtosFilePath, `create-${entityNameArquivoCase}-body.ts`)
        fs.writeFileSync(createDtoPath, createDtoContent)
        await prettifyFile(createDtoPath)
        const updateDtoTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'dto-update-body.ejs')
        const updateDtoContent = await ejs.renderFile(updateDtoTemplatePath, templateData)
        const updateDtoPath = path.join(dtosFilePath, `update-${entityNameArquivoCase}-body.ts`)
        fs.writeFileSync(updateDtoPath, updateDtoContent)
        await prettifyFile(updateDtoPath)
        //viewModel
        const viewModelTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'view-model.ejs')
        const viewModelContent = await ejs.renderFile(viewModelTemplatePath, templateData)
        const viewModelPath = path.join(viewModelFilePath, `${entityNameArquivoCase}-view-model.ts`)
        fs.writeFileSync(viewModelPath, viewModelContent)
        await prettifyFile(viewModelPath)

        print.success(`Entity, model, and repository files for "${entityName}" created successfully.`)

        // Check if the database.module file exists
        if (!filesystem.exists(httpModuleFilePath)) {
            error(`The database module file '${httpModuleFilePath}' does not exist.`)
            return
        }

        try {
            // Read the content of the database.module file
            await prettifyFile(httpModuleFilePath)
            let moduleContent = await filesystem.read(httpModuleFilePath)

            // Check if the provider is already present in the module
            if (moduleContent.includes(entityName)) {
                success(`The provider '${entityName}' is already present in the module.`)
                return
            }

            // Check if the import statement is already present in the module
            const importStatement = `import { Create${nameTitleCase} } from 'src/application/use-cases/${entityNameArquivoCase}/create-${entityNameArquivoCase}';
            import { Update${nameTitleCase} } from 'src/application/use-cases/${entityNameArquivoCase}/update-${entityNameArquivoCase}';
            import { Find${nameTitleCase} } from 'src/application/use-cases/${entityNameArquivoCase}/find-${entityNameArquivoCase}';
            import { FindMany${nameTitleCase} } from 'src/application/use-cases/${entityNameArquivoCase}/find-many-${entityNameArquivoCase}';
            import { Delete${nameTitleCase} } from 'src/application/use-cases/${entityNameArquivoCase}/delete-${entityNameArquivoCase}';
            import { ${nameTitleCase}Controller } from './controllers/${entityNameArquivoCase}.controller';\n`
            if (!moduleContent.includes(importStatement)) {
                // If the import is not present, add it at the top of the file

                await setTimeout(async () => {}, 500)
                await toolbox.patching.patch(httpModuleFilePath, {
                    insert: importStatement,
                    before: `\nconst`,
                })
                // await prettifyFile(httpModuleFilePath)
                const updatedModuleContent = await filesystem.read(httpModuleFilePath)
                moduleContent = updatedModuleContent
            }

            const importStatementCASES = `const USE_CASES_${entityName.toLocaleUpperCase()} = [Create${nameTitleCase}, Update${nameTitleCase}, Delete${nameTitleCase}, Find${nameTitleCase}, FindMany${nameTitleCase}];\n`
            if (!moduleContent.includes(importStatementCASES)) {
                // If the import is not present, add it at the top of the file
                await toolbox.patching.patch(httpModuleFilePath, {
                    insert: importStatementCASES,
                    before: `@Module({`,
                })
                await setTimeout(async () => {}, 500)

                //  await prettifyFile(httpModuleFilePath)
                const updatedModuleContent = await filesystem.read(httpModuleFilePath)
                moduleContent = updatedModuleContent
            }

            // Find the position of the "providers" array in the module file
            const providersRegex = /providers:\s*\[[^\]]*\]/
            const providersMatch = moduleContent.match(providersRegex)

            if (!providersMatch) {
                error('Could not find the "providers" array in the module.')
                return
            }

            // Find the position of the "controllers" array in the module file
            const controllersRegex = /controllers:\s*\[[^\]]*\]/
            const controllersMatch = moduleContent.match(controllersRegex)

            if (!controllersMatch) {
                error('Could not find the "controllers" array in the module.')
                return
            }

            // Add the new provider to the "providers" and "controllers" arrays
            let updatedModuleContent = moduleContent
                .replace(providersRegex, (match) => match.replace(']', ` ...USE_CASES_${entityName.toLocaleUpperCase()} ]`))
                .replace(controllersRegex, (match) => match.replace(']', ` ${nameTitleCase}Controller, ]`))
                await setTimeout(async () => {}, 500)

            // Overwrite the module file with the updated content
                await filesystem.write(httpModuleFilePath, updatedModuleContent)
                await setTimeout(async () => {}, 500)

                await prettifyFile(httpModuleFilePath)
                await setTimeout(async () => {}, 500)

            success(`Provider '${entityName}' added to the module.`)
        } catch (e) {
            error(`An error occurred while adding the provider '${entityName}' to the module: ${e.message}`)
        }
        // Generate the code to add the provider dynamically
        const contentToAdd = `{
      provide: I${nameTitleCase}Repository,
      useClass: ${nameTitleCase}Repository,
    },\n`

        // Check if the database.module file exists
        if (!filesystem.exists(databaseModuleFilePath)) {
            error(`The database module file '${databaseModuleFilePath}' does not exist.`)
            return
        }

        try {
            // Read the content of the database.module file
            await prettifyFile(databaseModuleFilePath)
            let moduleContent = filesystem.read(databaseModuleFilePath)

            // Check if the provider is already present in the module
            if (moduleContent.includes(entityName)) {
                success(`The provider '${entityName}' is already present in the module.`)
                return
            }

            // Check if the import statement is already present in the module
            const importStatement = `import { I${nameTitleCase}Repository } from 'src/domain/repositories/${entityNameArquivoCase}-repository';
import { ${nameTitleCase}Repository } from './typeorm/repositories/${entityNameArquivoCase}-repository';
import { ${nameTitleCase}Entity } from './typeorm/entities/${entityNameArquivoCase}.entity';\n`
            if (!moduleContent.includes(importStatement)) {
                // If the import is not present, add it at the top of the file
                await toolbox.patching.patch(databaseModuleFilePath, {
                    insert: importStatement,
                    before: `\n@Module({`,
                })
                const updatedModuleContent = await filesystem.read(databaseModuleFilePath)
                moduleContent = updatedModuleContent
            }

            // Find the position of the "providers" array in the module file
            const providersRegex = /providers:\s*\[[^\]]*\]/
            const providersMatch = moduleContent.match(providersRegex)

            if (!providersMatch) {
                error('Could not find the "providers" array in the module.')
                return
            }

            // Find the position of the "exports" array in the module file
            const exportsRegex = /exports:\s*\[[^\]]*\]/
            const exportsMatch = moduleContent.match(exportsRegex)

            if (!exportsMatch) {
                error('Could not find the "exports" array in the module.')
                return
            }

            // Find the position of the TypeOrmModule.forFeature array in the module file
            const TypeOrmModuleRegex = /TypeOrmModule.forFeature\(\s*\[[^\]]*\]/
            const TypeOrmModuleMatch = moduleContent.match(TypeOrmModuleRegex)

            if (!TypeOrmModuleMatch) {
                error('Could not find the "TypeOrmModule" array in the module.')
                return
            }

            // Add the new provider to the "providers" and "exports" arrays
            let updatedModuleContent = moduleContent
                .replace(providersRegex, (match) => match.replace(']', ` ${contentToAdd} ]`))
                .replace(exportsRegex, (match) => match.replace(']', ` I${nameTitleCase}Repository, ]`))
            updatedModuleContent = updatedModuleContent.replace(TypeOrmModuleRegex, (match) => match.replace(']', ` ${nameTitleCase}Entity ]`))

            // Overwrite the module file with the updated content
            await setTimeout(async () => {
                await filesystem.write(databaseModuleFilePath, updatedModuleContent)
            }, 500)
            await setTimeout(async () => {
                await prettifyFile(databaseModuleFilePath)
            }, 500)
            success(`Provider '${entityName}' added to the module.`)
        } catch (e) {
            error(`An error occurred while adding the provider '${entityName}' to the module: ${e.message}`)
        }

        async function prettifyFile(filePath: string) {
            // Use prettier to format the modified file
            const options = await prettier.resolveConfig(cwd)
            //
            if (!options) return
            const fileContent = fs.readFileSync(filePath, 'utf-8')
            const formattedContent = prettier.format(fileContent, { ...options, filepath: filePath })
            fs.writeFileSync(filePath, formattedContent)
        }
        // Function to generate entity properties
        async function  generateProperties() {
            // Customize this function to generate properties based on your requirements

            let props = JSON.parse(await filesystem.read(path.join(cwd, 'newEntityProp.json')) ) as {
                prop: string,
                type: string,
                default: null | string,
                required: boolean,
            }[]
            return props;
            // For example:
            // return [
            //     {
            //         prop: 'name',
            //         type: 'string',
            //         default: 'teste',
            //     },
            //     {
            //         prop: 'xx',
            //         type: 'number',
            //         default: null,
            //         required: true,
            //     },
            // ]
        }

        // Function to convert entity name to title case
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
    },
}
