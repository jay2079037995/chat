export const TEST_USERS = {
  primary: { username: 'testuser_e2e', password: 'Password123!' },
  secondary: { username: 'testuser2_e2e', password: 'Password456!' },
  searchTarget: { username: 'alice_e2e', password: 'Password789!' },
  tertiary: { username: 'testuser3_e2e', password: 'Password101!' },
} as const;

export const URLS = {
  login: '/login',
  register: '/register',
  home: '/',
} as const;
