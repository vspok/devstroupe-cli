import { GluegunToolbox } from 'gluegun'
import * as path from 'path'
import * as fs from 'fs'
import * as prettier from 'prettier'

export default {
    name: 'update-entity',
    alias: ['ue'],
    description: 'Adicionar novos campos a uma entidade existente',
    run: async (toolbox: GluegunToolbox) => {
        const { print, parameters } = toolbox
        const entityName = parameters.first

        if (!entityName) {
            print.error('Por favor, forneça o nome da entidade.')
            return
        }

        const cwd = process.cwd()
        const isTenant = parameters.second === 't' || parameters.second === 'tenant' // Verifica se é tenant

        const entitiesFolderPath = path.join(cwd, 'src', 'infra', 'database', 'typeorm', 'entities', isTenant ? 'tenanted' : '')
        const modelsFolderPath = path.join(cwd, 'src', 'domain', 'models', isTenant ? 'tenanted' : '')

        const entityFilePath = path.join(entitiesFolderPath, `${toArquivoCase(entityName)}.entity.ts`)
        const modelFilePath = path.join(modelsFolderPath, `${toArquivoCase(entityName)}.ts`)

        // Verificar se a entidade existe
        if (!fs.existsSync(entityFilePath)) {
            print.error(`A entidade '${entityName}' não existe.`)
            return
        }

        // Ler os novos campos do usuário
        const newFields = await askForNewFields(toolbox)
        if (newFields.length === 0) {
            print.info('Nenhum campo foi adicionado.')
            return
        }

        // Atualizar a entidade
        await updateEntityFile(entityFilePath, newFields)
        print.success(`Campos adicionados à entidade '${entityName}' com sucesso.`)

        // Atualizar a model
        await updateModelFile(modelFilePath, newFields)
        print.success(`Model atualizada para a entidade '${entityName}'.`)

        // Atualizar DTOs
        const dtosFolderPath = path.join(cwd, 'src', 'infra', 'http', 'dtos')
        const createDtoPath = path.join(dtosFolderPath, `create-${toArquivoCase(entityName)}-body.ts`)
        const updateDtoPath = path.join(dtosFolderPath, `update-${toArquivoCase(entityName)}-body.ts`)

        await updateDtoFile(createDtoPath, newFields, 'Create')
        await updateDtoFile(updateDtoPath, newFields, 'Update')
        print.success(`DTOs atualizados para a entidade '${entityName}'.`)
    },
}

async function askForNewFields(toolbox: GluegunToolbox): Promise<any[]> {
    const { prompt } = toolbox
    const fields: any[] = []

    while (true) {
        const resultName = await prompt.ask([
            {
                type: 'input',
                name: 'name',
                message: 'Nome do campo (deixe em branco para finalizar):',
            },
        ])

        if (!resultName.name) break

        const resultType = await prompt.ask([
            {
                type: 'list',
                name: 'type',
                message: 'Tipo do campo:',
                choices: ['string', 'number', 'boolean', 'Date'],
            },
        ])

        const resultConfirm = await prompt.ask([
            {
                type: 'confirm',
                name: 'required',
                message: 'O campo é obrigatório?',
            },
        ])

        const result = {
            name: resultName.name,
            type: resultType.type,
            required: resultConfirm.required,
        }

        fields.push(result)
    }

    return fields
}

async function updateEntityFile(filePath: string, newFields: any[]) {
    let content = fs.readFileSync(filePath, 'utf-8')

    // Gerar código para os novos campos
    const newFieldsCode = generatePropsCode(newFields)

    // Tenta inserir antes do @CreateDateColumn
    const createDateColumnRegex = /(\s*@CreateDateColumn[^\n]*\n)/

    if (createDateColumnRegex.test(content)) {
        content = content.replace(createDateColumnRegex, `${newFieldsCode}\n$1`)
    } else {
        // Se não encontrar, insere antes do último }
        content = content.replace(/(\s*}\s*$)/, `${newFieldsCode}\n$1`)
    }

    // Salvar o arquivo atualizado
    fs.writeFileSync(filePath, content)
    await prettifyFile(filePath)
}

async function updateModelFile(filePath: string, newFields: any[]) {
    if (!fs.existsSync(filePath)) {
        console.warn(`O arquivo '${filePath}' não existe. Pulando...`)
        return
    }

    let content = fs.readFileSync(filePath, 'utf-8')

    // Gerar código para os novos campos na model
    const newFieldsCode = newFields
        .map((field) => {
            return `${field.name}: ${field.type};`
        })
        .join('\n')

    // Inserir os novos campos antes do último `}`
    content = content.replace(/(\s*}\s*$)/, `${newFieldsCode}\n$1`)

    // Salvar o arquivo atualizado
    fs.writeFileSync(filePath, content)
    await prettifyFile(filePath)
}

async function updateDtoFile(filePath: string, newFields: any[], dtoType: string) {
    if (!fs.existsSync(filePath)) {
        console.warn(`O arquivo '${filePath}' não existe. Pulando...`)
        return
    }

    let content = fs.readFileSync(filePath, 'utf-8')

    // Gerar código para os novos campos no DTO, incluindo decorators
    const newFieldsCode = newFields
        .map((field) => {
            const isOptional = !field.required && dtoType === 'Update'
            const decorators = [`@ApiProperty({ required: ${field.required ? 'true' : 'false'} })`, isOptional ? '@IsOptional()' : '']
                .filter(Boolean)
                .join('\n  ')
            return `${decorators}\n  ${field.name}${isOptional ? '?' : ''}: ${field.type};`
        })
        .join('\n\n')

    // Inserir os novos campos antes do último `}`
    content = content.replace(/(\s*}\s*$)/, `\n${newFieldsCode}\n$1`)

    // Salvar o arquivo atualizado
    fs.writeFileSync(filePath, content)
    await prettifyFile(filePath)
}

function generatePropsCode(fields: any[]): string {
    return fields
        .map((field) => {
            // Cria dinamicamente o objeto de opções da coluna
            const columnOptions: Record<string, any> = {}

            if (field.required) {
                columnOptions.nullable = false
            } else {
                columnOptions.nullable = true
            }

            // Monta a string das opções do decorator
            const optionsString = Object.keys(columnOptions).length
                ? `{ ${Object.entries(columnOptions)
                      .map(([k, v]) => (typeof v === 'string' ? `${k}: '${v}'` : `${k}: ${JSON.stringify(v)}`))
                      .join(', ')} }`
                : ''

            let propCode = optionsString ? `@Column(${optionsString})\n  ${field.name}: ${field.type};` : `@Column()\n  ${field.name}: ${field.type};`

            return propCode
        })
        .join('\n\n')
}

function toArquivoCase(input: string): string {
    return input
        .trim()
        .replace(/[_-]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
}

async function prettifyFile(filePath: string) {
    const options = await prettier.resolveConfig(process.cwd())
    if (!options) return
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const formattedContent = prettier.format(fileContent, { ...options, filepath: filePath })
    fs.writeFileSync(filePath, formattedContent)
}
