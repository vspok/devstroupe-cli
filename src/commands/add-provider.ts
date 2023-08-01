// src/cli/add-provider.js

module.exports = {
  name: 'add-provider',
  description: 'Adicionar provider ao módulo existente',
  run: async toolbox => {
    const {
      parameters,
      print: { error, success },
      filesystem,
    } = toolbox;

    // Pegue os parâmetros do comando
    const repositoryName = parameters.first;

    if (!repositoryName) {
      error('Uso correto: add-provider <nome-do-repositorio>');
      return;
    }

    // Defina o caminho para o arquivo do módulo
    const moduleFilePath = 'src/app.module.ts'; // Substitua pelo caminho correto do seu módulo

    // Verifique se o módulo existe
    if (!filesystem.exists(moduleFilePath)) {
      error(`O arquivo do módulo '${moduleFilePath}' não existe.`);
      return;
    }

    try {
      // Ler o conteúdo do arquivo do módulo
      let moduleContent = filesystem.read(moduleFilePath);

      // Verificar se o provider já está presente no módulo
      if (moduleContent.includes(repositoryName)) {
        success(`O provider '${repositoryName}' já está presente no módulo.`);
        return;
      }

      // Verificar se o import já está presente no módulo
      const importStatement = `import { ${repositoryName} } from './${repositoryName}.provider';`;
      if (!moduleContent.includes(importStatement)) {
        // Se o import ainda não está presente, adicione-o ao topo do arquivo
        const updatedModuleContent = importStatement + '\n' + moduleContent;
        filesystem.write(moduleFilePath, updatedModuleContent);
        moduleContent = updatedModuleContent
      }

      // Encontre a posição do array "providers" no arquivo do módulo
      const providersRegex = /providers:\s*\[[^\]]*\]/;
      const providersMatch = moduleContent.match(providersRegex);

      if (!providersMatch) {
        error('Não foi possível encontrar o array "providers" no módulo.');
        return;
      }

      // Encontre a posição do array "exports" no arquivo do módulo
      const exportsRegex = /exports:\s*\[[^\]]*\]/;
      const exportsMatch = moduleContent.match(exportsRegex);

      if (!exportsMatch) {
        error('Não foi possível encontrar o array "exports" no módulo.');
        return;
      }

      // Adicione o novo provider ao array "providers" e "exports"
      const updatedModuleContent = moduleContent
        .replace(providersRegex, match => match.replace(']', `${repositoryName}, ]`))
        .replace(exportsRegex, match => match.replace(']', `${repositoryName}, ]`));

      // Sobrescreva o arquivo do módulo com o novo conteúdo
      filesystem.write(moduleFilePath, updatedModuleContent);

      success(`Provider '${repositoryName}' adicionado ao módulo.`);
    } catch (e) {
      error(`Ocorreu um erro ao adicionar o provider '${repositoryName}' ao módulo: ${e.message}`);
    }
  },
};
