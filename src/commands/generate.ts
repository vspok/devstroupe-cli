import { GluegunToolbox } from 'gluegun'

module.exports = {
  name: 'generate:nest:moduleV1',
  alias: ['gnmv1', 'gnm'],
  run: async (toolbox: GluegunToolbox) => {
    const {
      parameters,
      template: { generate },
      print: { info , error},
    } = toolbox
    if (!parameters.first) {
      error('fornece o nome do módulo')
    }
    let name_format= "";
    
    const palavras = parameters.first.split(/\s|-|_/g);
    for (let index = 0; index < palavras.length; index++) {
      let str = palavras[index];
      name_format = name_format + str[0].toUpperCase() + str.substring(1);
      
    }
    const name = name_format;
    console.log(name)
    const arquivo_name = parameters.first;
    const provide_name = (parameters.first).toUpperCase()+"_REPOSITORY";
    const entity_name = parameters.first[parameters.first.length - 1] === 's' ? parameters.first.substring(0, parameters.first.length - 1) : parameters.first;
    console.log(entity_name)

    await generate({
      template: 'nest/v1/module.ts.ejs',
      target: `src/${arquivo_name}/${arquivo_name}.module.ts`,
      props: {arquivo_name, name, provide_name },
    })

    info(`Generated file at src/${arquivo_name}/${arquivo_name}.module.ts`)

    await generate({
      template: 'nest/v1/entity.ts.ejs',
      target: `src/${arquivo_name}/entities/${arquivo_name}.entity.ts`,
      props: {arquivo_name, name, provide_name, entity_name },
    })

    info(`Generated file at src/${arquivo_name}/entities/${arquivo_name}.entity.ts`)

    await generate({
      template: 'nest/v1/controller.ts.ejs',
      target: `src/${arquivo_name}/${arquivo_name}.controller.ts`,
      props: {arquivo_name, name, provide_name, entity_name },
    })

    info(`Generated file at src/${arquivo_name}/${arquivo_name}.controller.ts`)
    await generate({
      template: 'nest/v1/dto/cadastro.dto.ts.ejs',
      target: `src/${arquivo_name}/dto/${arquivo_name}.cadastro.dto.ts`,
      props: {arquivo_name, name, provide_name, entity_name },
    })

    info(`Generated file at src/${arquivo_name}/${arquivo_name}.cadastro.dto.ts`)
    await generate({
      template: 'nest/v1/dto/filtro.dto.ts.ejs',
      target: `src/${arquivo_name}/dto/${arquivo_name}.filtro.dto.ts`,
      props: {arquivo_name, name, provide_name, entity_name },
    })

    info(`Generated file at src/${arquivo_name}/${arquivo_name}.filtro.dto.ts`)
    await generate({
      template: 'nest/v1/service.ts.ejs',
      target: `src/${arquivo_name}/${arquivo_name}.service.ts`,
      props: {arquivo_name, name, provide_name, entity_name },
    })

    info(`Generated file at src/${arquivo_name}/${arquivo_name}.service.ts`)
  },
}
