/**
 * Shared Prisma mock factory.
 * Returns an object shaped like PrismaService with every model method mocked via jest.fn().
 * The $transaction mock dispatches both array-form and callback-form automatically.
 */
export function createPrismaMock() {
  const mockModel = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  });

  const mock = {
    user: mockModel(),
    questTemplate: mockModel(),
    questLobby: mockModel(),
    message: mockModel(),
    messageReaction: mockModel(),
    matchReview: mockModel(),
    pushSubscription: mockModel(),
    appConfig: mockModel(),
    userAchievement: mockModel(),
    timeSlot: mockModel(),
    block: mockModel(),
    report: mockModel(),
    userPhoto: mockModel(),
    loginSession: mockModel(),
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };

  // Smart dispatcher: handles both callback-form and array-form
  mock.$transaction.mockImplementation((arg: any) => {
    if (typeof arg === 'function') {
      return arg(mock);
    }
    return Promise.all(arg);
  });

  return mock;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
