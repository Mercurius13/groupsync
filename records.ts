import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
const allRecords = await prisma.user.findMany() // Replace 'user' with your model name
  console.log(JSON.stringify(allRecords, null, 2))
}

main().finally(async () => await prisma.$disconnect())
