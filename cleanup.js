const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log("Starting cleanup of test data...");

  // Find all test users
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@test.com' } }
  });
  
  if (testUsers.length === 0) {
    console.log("No test users found.");
  } else {
    const userIds = testUsers.map(u => u.id);
    
    // Find all problems created by test users (or we can just delete submissions by these users)
    // Actually let's just delete all submissions belonging to test users OR test problems
    console.log("Deleting test submissions...");
    await prisma.submission.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { problem: { creatorId: { in: userIds } } }
        ]
      }
    });

    console.log("Deleting test cases...");
    await prisma.testCase.deleteMany({
      where: {
        problem: { creatorId: { in: userIds } }
      }
    });

    console.log("Deleting test problems...");
    await prisma.problem.deleteMany({
      where: { creatorId: { in: userIds } }
    });

    console.log("Deleting test users...");
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });
    
    console.log(`Cleanup complete! Deleted ${testUsers.length} test users and their associated data.`);
  }
}

cleanup()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
