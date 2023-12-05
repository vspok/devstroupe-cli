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

            print,
            print: { error, success },
            filesystem,
        } = toolbox

        // Check if the entity name is provided
        const cwd = process.cwd()
        let entities = await generateProperties()

        for (let index = 0; index < entities.length; index++) {
            const entity = entities[index]
            const entityName = toSnakeCase(entity.name)
            // Convert entity name to title case
            const nameTitleCase = toTitleCase(entity.name)
            const entityNameCamelCase = toCamelCase(entity.name)
            const entityNameArquivoCase = toArquivoCase(entity.name)

            if (!entityName) {
                print.error('Please provide a name for the entity.')
                continue
            }
            //paths cwd
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
                continue
            }

            let entityData = entity
            let entityProperties = entityData.props
            let relationships = entityData.relationships

            // Generate entity properties
            const propsCode = generatePropsCode(entityProperties)
            const relationshipsCode = generateRelationshipsCode(relationships, entityData)
            const relationshipsImports = relationships.map((relationship) => `import { ${toTitleCase(relationship.entity)}Entity } from './${toArquivoCase(relationship.entity)}.entity';`).join('\n')

            // Template EJS data
            const templateData = {
                entityName: entityName,
                entityNameTitleCase: nameTitleCase,
                entityNameCamelCase: entityNameCamelCase,
                entityNameArquivoCase: entityNameArquivoCase,
                entityNameLowerCase: entityName.toLowerCase(),
                properties: entityProperties,
                relationships: relationships,
                propsCode: propsCode,
                relationshipsCode: relationshipsCode,
                relationshipsImports: relationshipsImports,
            }
            const generatedCode = `
        import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, ManyToOne,OneToOne, OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
        ${relationshipsImports}
        @Entity('${entityName}')
        export class ${templateData.entityNameTitleCase}Entity {
          @PrimaryGeneratedColumn()
          ${templateData.entityNameLowerCase}_id: number;

          ${propsCode}

          ${relationshipsCode}
          @CreateDateColumn()
            createdAt: Date;

            @UpdateDateColumn()
            updatedAt: Date;

            @DeleteDateColumn({ default: null })
            deletedAt: Date;
        }
        `
            // Render Entity Template
            // const entityTemplatePath = path.join(__dirname, '..', 'src', 'templates', 'entity.ejs')
            const entityContent = generatedCode

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
                continue
            }

            try {
                // Read the content of the database.module file

                success(`010`)
                await prettifyFile(httpModuleFilePath)
                success(`011`)
                let moduleContent = await filesystem.readAsync(httpModuleFilePath)
                await new Promise((resolve) => setTimeout(resolve, 1000))

                success(`012`)

                // Check if the provider is already present in the module
                if (moduleContent.includes(`{ Update${nameTitleCase} }`)) {
                    error(`The provider '${entityName}' is already present in the module.`)
                    continue
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

                    success(`013`)
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    await toolbox.patching.patch(httpModuleFilePath, {
                        insert: importStatement,
                        before: `\nconst`,
                    })
                    success(`01`)

                    await new Promise((resolve) => setTimeout(resolve, 2000))
                    // await prettifyFile(httpModuleFilePath)
                    const updatedModuleContent = await filesystem.readAsync(httpModuleFilePath)
                    moduleContent = updatedModuleContent
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                }

                const importStatementCASES = `const USE_CASES_${entityName.toLocaleUpperCase()} = [Create${nameTitleCase}, Update${nameTitleCase}, Delete${nameTitleCase}, Find${nameTitleCase}, FindMany${nameTitleCase}];\n`
                if (!moduleContent.includes(importStatementCASES)) {
                    success(`02`)

                    // If the import is not present, add it at the top of the file
                    await toolbox.patching.patch(httpModuleFilePath, {
                        insert: importStatementCASES,
                        before: `@Module({`,
                    })
                    success(`03`)

                    await new Promise((resolve) => setTimeout(resolve, 1000))

                    //  await prettifyFile(httpModuleFilePath)
                    const updatedModuleContent = await filesystem.readAsync(httpModuleFilePath)
                    moduleContent = updatedModuleContent
                }

                // Find the position of the "providers" array in the module file
                const providersRegex = /providers:\s*\[[^\]]*\]/
                const providersMatch = moduleContent.match(providersRegex)

                if (!providersMatch) {
                    error('Could not find the "providers" array in the module.')
                    continue
                }

                // Find the position of the "controllers" array in the module file
                const controllersRegex = /controllers:\s*\[[^\]]*\]/
                const controllersMatch = moduleContent.match(controllersRegex)

                if (!controllersMatch) {
                    error('Could not find the "controllers" array in the module.')
                    continue
                }

                // Add the new provider to the "providers" and "controllers" arrays
                let updatedModuleContent = moduleContent
                    .replace(providersRegex, (match) => match.replace(']', ` ...USE_CASES_${entityName.toLocaleUpperCase()} ]`))
                    .replace(controllersRegex, (match) => match.replace(']', ` ${nameTitleCase}Controller, ]`))
                await new Promise((resolve) => setTimeout(resolve, 200))
                success(`1`)

                // Overwrite the module file with the updated content
                await filesystem.writeAsync(httpModuleFilePath, updatedModuleContent)
                success(`2`)

                await new Promise((resolve) => setTimeout(resolve, 200))
                success(`3`)

                await prettifyFile(httpModuleFilePath)
                success(`4`)

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
                continue
            }

            try {
                // Read the content of the database.module file
                success(`M011`)
                await prettifyFile(databaseModuleFilePath)
                await new Promise((resolve) => setTimeout(resolve, 500))

                success(`M012`)

                let moduleContent = await filesystem.readAsync(databaseModuleFilePath)
                success(`M013`)

                // Check if the provider is already present in the module
                if (moduleContent.includes(`import { I${nameTitleCase}Repository }`)) {
                    error(`The provider '${entityName}' is already present in the module.`)
                    continue
                }

                // Check if the import statement is already present in the module
                const importStatement = `import { I${nameTitleCase}Repository } from 'src/domain/repositories/${entityNameArquivoCase}-repository';
import { ${nameTitleCase}Repository } from './typeorm/repositories/${entityNameArquivoCase}-repository';
import { ${nameTitleCase}Entity } from './typeorm/entities/${entityNameArquivoCase}.entity';\n`
                if (!moduleContent.includes(importStatement)) {
                    // If the import is not present, add it at the top of the file
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    success(`M014`)

                    await toolbox.patching
                        .patch(databaseModuleFilePath, {
                            insert: importStatement,
                            before: `\n@Module({`,
                        })
                        .catch((e) => {
                            error(`M01aaaaa` + e)
                        })
                    success(`M015`)
                    await new Promise((resolve) => setTimeout(resolve, 500))

                    const updatedModuleContent = await filesystem.readAsync(databaseModuleFilePath)
                    moduleContent = updatedModuleContent
                    success(`M016`)
                }

                // Find the position of the "providers" array in the module file
                const providersRegex = /providers:\s*\[[^\]]*\]/
                const providersMatch = moduleContent.match(providersRegex)

                if (!providersMatch) {
                    error('Could not find the "providers" array in the module.')
                    continue
                }

                // Find the position of the "exports" array in the module file
                const exportsRegex = /exports:\s*\[[^\]]*\]/
                const exportsMatch = moduleContent.match(exportsRegex)

                if (!exportsMatch) {
                    error('Could not find the "exports" array in the module.')
                    continue
                }

                // Find the position of the TypeOrmModule.forFeature array in the module file
                const TypeOrmModuleRegex = /TypeOrmModule.forFeature\(\s*\[[^\]]*\]/
                const TypeOrmModuleMatch = moduleContent.match(TypeOrmModuleRegex)

                if (!TypeOrmModuleMatch) {
                    error('Could not find the "TypeOrmModule" array in the module.')
                    continue
                }

                // Add the new provider to the "providers" and "exports" arrays
                let updatedModuleContent = moduleContent
                    .replace(providersRegex, (match) => match.replace(']', ` ${contentToAdd} ]`))
                    .replace(exportsRegex, (match) => match.replace(']', ` I${nameTitleCase}Repository, ]`))
                updatedModuleContent = updatedModuleContent.replace(TypeOrmModuleRegex, (match) => match.replace(']', ` ${nameTitleCase}Entity ]`))
                success(`M017`)

                // Overwrite the module file with the updated content
                await new Promise((resolve) => setTimeout(resolve, 300))
                await filesystem.writeAsync(databaseModuleFilePath, updatedModuleContent)
                success(`M018`)

                await new Promise((resolve) => setTimeout(resolve, 300))
                await prettifyFile(databaseModuleFilePath)
                success(`M019`)

                success(`Provider '${entityName}' added to the module.`)
            } catch (e) {
                error(`An error occurred while adding the provider '${entityName}' to the module: ${e.message}`)
            }
            await new Promise((resolve) => setTimeout(resolve, 1000))

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
        async function generateProperties() {
            // Customize this function to generate properties based on your requirements

            let props = JSON.parse(await filesystem.readAsync(path.join(cwd, 'newEntityProp.json'))) as {
                name: string,
                props: {
                    prop: string,
                    type: string,
                    required?: true,
                    default?: any,
                }[

                ],
                relationships?: {
                    name: string,
                    type: string,
                    entity: string,
                }[],
            }[]
            return props
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
            // return [
            //     {
            //         name: 'teste',
            //         props: [
            //             {
            //                 prop: 'valor',
            //                 type: 'number',
            //                 required: true,
            //                 default: 'generated',
            //             },
            //             {
            //                 prop: 'username',
            //                 type: 'string',
            //                 required: true,
            //             },
            //         ],
            //         relationships: [
            //             {
            //                 name: 'roles',
            //                 type: 'many-to-many',
            //                 entity: 'role',
            //             },
            //         ],
            //     },
            //     {
            //         name: 'role',
            //         props: [
            //             {
            //                 prop: 'valor',
            //                 type: 'number',
            //                 required: true,
            //                 default: 'generated',
            //             },
            //             {
            //                 prop: 'username',
            //                 type: 'string',
            //                 required: true,
            //             },
            //         ],
            //         relationships: [
            //             {
            //                 name: 'testes',
            //                 type: 'many-to-many',
            //                 entity: 'teste',
            //             },
            //         ],
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
        function generatePropsCode(props) {
            return props
                .map((prop) => {
                    let propCode = `@Column()`

                    if (prop.type === 'string') {
                        propCode += `
            ${prop.prop}: string;`
                    } else if (prop.type === 'number') {
                        propCode += `
            ${prop.prop}: number;`
                    } else if (prop.type === 'boolean') {
                        propCode += `
            ${prop.prop}: boolean;`
                    } else if (prop.type === 'Date') {
                        propCode += `
            ${prop.prop}: Date;`
                    } // Pode adicionar mais tipos conforme necessário
                    let valueDefault = prop.default;
                    if (prop.default) {
                        if(prop.default == 'new_date') {
                            valueDefault = () => "CURRENT_TIMESTAMP";
                        }
                    }
                    if (prop.required && prop.default) {
                        propCode = `@Column({ nullable: false,  default: '${valueDefault}'})\n  ${propCode.replace(`@Column()`, '')}`
                    } else if (prop.required) {
                        propCode = `@Column({ nullable: false })\n  ${propCode.replace(`@Column()`, '')}`
                    } else if (prop.default) {
                        propCode = `@Column({ default: '${valueDefault}' })\n  ${propCode.replace(`@Column()`, '')}`
                    }

                    return propCode
                })
                .join('\n\n')
        }
        function generateRelationshipsCode(relationships, entityData) {
            return relationships
              .map((relationship) => {
                let relCode = '';

                if (relationship.type === 'many-to-many') {
                  relCode = `@ManyToMany(type => ${
                    toTitleCase(relationship.entity)
                  }Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(relationship.entity)})\n  ${
                    relationship.name
                  }: ${toTitleCase(relationship.entity)}Entity[];`;
                } else if (relationship.type === 'many-to-one') {
                //   relCode = `@ManyToOne(type => ${
                //     toTitleCase(relationship.entity)
                //   }Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(relationship.entity)}.${entityData.name.toLowerCase()}s)\n  ${
                //     relationship.name
                //   }: ${toTitleCase(relationship.entity)}Entity;`;
                  relCode = `@ManyToOne(type => ${
                    toTitleCase(relationship.entity)
                  }Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(relationship.entity)})\n  ${
                    relationship.name
                  }: ${toTitleCase(relationship.entity)}Entity;`;
                } else if (relationship.type === 'one-to-many') {
                  relCode = `@OneToMany(type => ${
                    toTitleCase(relationship.entity)
                  }Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(relationship.entity)})\n  ${
                    relationship.name
                  }: ${toTitleCase(relationship.entity)}Entity[];`;
                } else if (relationship.type === 'one-to-one') {
                  relCode = `@OneToOne(type => ${
                    toTitleCase(relationship.entity)
                  }Entity, ${toSnakeCase(relationship.entity)} => ${toSnakeCase(relationship.entity)})\n  ${
                    relationship.name
                  }: ${toTitleCase(relationship.entity)}Entity;`;
                }

                return relCode;
              })
              .join('\n\n');
          }

    },
}
