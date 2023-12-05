import { GluegunCommand } from 'gluegun'
import * as path from 'path'

const command: GluegunCommand = {
    name: 'rename-fields',
    alias: ['re'],
    run: async (toolbox) => {
        const {
            print: { error, success },
            filesystem,
          } = toolbox;
        const cwd = process.cwd()
          success(path.join(cwd, 'CAMPOS_PARA_RENOMEAR.txt'))
          success(path.join(cwd, 'src'))
        const txtFilePath = path.join(cwd, 'CAMPOS_PARA_RENOMEAR.txt')
        error('13');
        const projectDirectory = path.join(cwd, 'src')
        error('12');
        function toSnakeCase(name) {
            return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
          }

          const txtContent = filesystem.read(txtFilePath);

          if (!txtContent) {
            error('Erro: Não foi possível ler o arquivo TXT.');
            return;
          }

          const fieldNames = txtContent.split('\n').map(line => line.trim());

          fieldNames.forEach(fieldName => {
            const snakeCaseName = toSnakeCase(fieldName);

            try {
              const filesToProcess = filesystem.find(projectDirectory, { matching: ['*.*'], directories: false });

              filesToProcess.forEach(filePath => {
                const content = filesystem.read(filePath);
                const updatedContent = content.replace(new RegExp(`\\b${fieldName}\\b`, 'g'), snakeCaseName);
                filesystem.write(filePath, updatedContent);
              });

              success(`O campo '${fieldName}' foi renomeado para '${snakeCaseName}'.`);
            } catch (err) {
              error(`Erro ao renomear o campo '${fieldName}' para '${snakeCaseName}': ${err.message}`);
            }
          });
    },
}

module.exports = command
