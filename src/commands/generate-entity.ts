// src/cli/generate-entity.ts

import { GluegunToolbox } from 'gluegun'
import * as path from 'path'
import * as fs from 'fs'
import * as ejs from 'ejs'
import * as prettier from 'prettier'

export default {
    name: 'generate-entity',
    alias: ['ge'],
    description: 'Generate entity, model, and repository files for NestJS',
    run: async (toolbox: GluegunToolbox) => {
        const {
            parameters,
            print,
            print: { error, success },
            filesystem,
        } = toolbox

        // Check if the entity name is provided
        const entityName = parameters.first

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
        const useCaseFolderPath = path.join(cwd, 'src', 'application', 'use-cases', entityName.toLowerCase())
        const databaseModuleFilePath = path.join(cwd, 'src', 'infra', 'database', 'database.module.ts')
        // const httpModuleFilePath = path.join(cwd, 'src', 'infra', 'http', 'http.module.ts')

        const entityFilePath = path.join(entitiesFolderPath, `${entityName.toLowerCase()}.entity.ts`)
        const repositoryFilePath = path.join(repositoriesInterfaceFolderPath, `${entityName.toLowerCase()}-repository.ts`)

        // Check if entity or repository with the same name already exists
        if (fs.existsSync(entityFilePath) || fs.existsSync(repositoryFilePath)) {
            print.error('Entity or repository with this name already exists.')
            return
        }

        // Convert entity name to title case
        const nameTitleCase = toTitleCase(entityName)

        // Generate entity properties
        const entityProperties = generateProperties().map((prop) => {
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
        const modelFilePath = path.join(modelsFolderPath, `${entityName.toLowerCase()}.ts`)
        fs.writeFileSync(modelFilePath, modelContent)
        await prettifyFile(modelFilePath)

        // Create repository interface file
        const repositoryInterfaceTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'repository-interface.ejs')
        const repositoryInterfaceContent = await ejs.renderFile(repositoryInterfaceTemplatePath, templateData)
        const repositoryInterfaceFilePath = path.join(repositoriesInterfaceFolderPath, `${entityName.toLowerCase()}-repository.ts`)
        fs.writeFileSync(repositoryInterfaceFilePath, repositoryInterfaceContent)
        await prettifyFile(repositoryInterfaceFilePath)

        // Create repository class file
        const repositoryClassTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'repository-class.ejs')
        const repositoryClassContent = await ejs.renderFile(repositoryClassTemplatePath, templateData)
        const repositoryClassFilePath = path.join(repositoriesFolderPath, `${entityName.toLowerCase()}-repository.ts`)
        fs.writeFileSync(repositoryClassFilePath, repositoryClassContent)
        await prettifyFile(repositoryClassFilePath)

        // Create mappers class file

        const mapperTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'mapper.ejs')
        const mapperContent = await ejs.renderFile(mapperTemplatePath, templateData)
        const mapperFilePath = path.join(mappersFolderPath, `${entityName.toLowerCase()}-mapper.ts`)
        fs.writeFileSync(mapperFilePath, mapperContent)
        await prettifyFile(mapperFilePath)

        // Create USECASES class file
        if (!fs.existsSync(useCaseFolderPath)) {
            fs.mkdirSync(useCaseFolderPath, { recursive: true });
          }
        // CREATE
        const useCaseCREATETemplatePath = path.join(__dirname, '..', 'src', 'templates', 'useCase-create.ejs')
        const useCaseCREATEContent = await ejs.renderFile(useCaseCREATETemplatePath, templateData)
        const useCaseCREATEFilePath = path.join(useCaseFolderPath, `create-${entityName.toLowerCase()}.ts`)
        fs.writeFileSync(useCaseCREATEFilePath, useCaseCREATEContent)
        await prettifyFile(useCaseCREATEFilePath)

        print.success(`Entity, model, and repository files for "${entityName}" created successfully.`)

        // Function to convert entity name to title case
        function toTitleCase(str: string): string {
            const words = str.split(/\s|-|_/g)
            const formattedWords = words.map((word) => word[0].toUpperCase() + word.substring(1))
            return formattedWords.join('')
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
            const importStatement = `import { I${nameTitleCase}Repository } from 'src/domain/repositories/${entityName}-repository';
import { ${nameTitleCase}Repository } from './typeorm/repositories/${entityName}-repository';
import { ${nameTitleCase}Entity } from './typeorm/entities/${entityName}.entity';\n`
            if (!moduleContent.includes(importStatement)) {
                // If the import is not present, add it at the top of the file
                await toolbox.patching.patch(databaseModuleFilePath, {
                    insert: importStatement,
                    before: `\n@Module({`,
                })
                const updatedModuleContent = filesystem.read(databaseModuleFilePath)
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
            filesystem.write(databaseModuleFilePath, updatedModuleContent)
            await prettifyFile(databaseModuleFilePath)
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
        function generateProperties() {
            // Customize this function to generate properties based on your requirements
            // For example:
            return [
                {
                    prop: 'name',
                    type: 'string',
                    default: 'teste',
                },
                {
                    prop: 'xx',
                    type: 'number',
                    default: null,
                    required: true,
                },
            ]
        }
    },
}
