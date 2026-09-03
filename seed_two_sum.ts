import { prisma } from './src/lib/prisma';

async function seed() {
  console.log("Seeding Two Sum problem...");

  // 1. Create a dummy professor user to own the problem
  const prof = await prisma.user.upsert({
    where: { email: 'admin@clanofcodes.com' },
    update: {},
    create: {
      email: 'admin@clanofcodes.com',
      passwordHash: 'dummy_hash',
      name: 'System Admin',
      role: 'PROFESSOR',
    }
  });

  // 2. Create the problem
  const problem = await prisma.problem.upsert({
    where: { slug: 'two-sum' },
    update: {
      description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

**Input Format:**
The first line contains an integer \`n\` (the size of the array).
The second line contains \`n\` space-separated integers representing the array \`nums\`.
The third line contains an integer \`target\`.

**Output Format:**
Print two space-separated integers representing the indices (0-indexed) of the two numbers.

**Constraints:**
- \`2 <= n <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Only one valid answer exists.`
    },
    create: {
      title: 'Two Sum',
      slug: 'two-sum',
      difficulty: 'EASY',
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      creatorId: prof.id,
      description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

**Input Format:**
The first line contains an integer \`n\` (the size of the array).
The second line contains \`n\` space-separated integers representing the array \`nums\`.
The third line contains an integer \`target\`.

**Output Format:**
Print two space-separated integers representing the indices (0-indexed) of the two numbers.

**Constraints:**
- \`2 <= n <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Only one valid answer exists.`
    }
  });

  // 3. Create test cases
  await prisma.testCase.deleteMany({
    where: { problemId: problem.id }
  });

  await prisma.testCase.createMany({
    data: [
      {
        problemId: problem.id,
        input: "4\n2 7 11 15\n9",
        expectedOutput: "0 1",
        isHidden: false
      },
      {
        problemId: problem.id,
        input: "3\n3 2 4\n6",
        expectedOutput: "1 2",
        isHidden: false
      },
      {
        problemId: problem.id,
        input: "2\n3 3\n6",
        expectedOutput: "0 1",
        isHidden: true
      }
    ]
  });

  console.log("Successfully seeded Two Sum!");
}

seed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
