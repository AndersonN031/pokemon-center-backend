🚀 Como rodar o projeto localmente

Siga os passos abaixo para configurar e iniciar o ambiente de desenvolvimento.

1️ - Iniciar o banco de dados
Primeiro, suba o container do PostgreSQL usando Docker:
docker-compose up -d

2️ - Criar o banco de dados
Crie um banco de dados no PostgreSQL conforme configurado no arquivo .env.
Exemplo:
DATABASE_URL="postgresql://user:password@localhost:5432/nome_do_banco"

3 - Rodar as migrations
Execute as migrations para criar as tabelas no banco:
npx prisma migrate dev

4️ - Gerar o Prisma Client
Depois das migrations, gere o client do Prisma:
npx prisma generate

5️ - Iniciar a aplicação
Por fim, inicie o servidor em modo de desenvolvimento:
npm run start:dev
