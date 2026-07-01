import axios from 'axios';
import { AuthService } from '../../../src/core/openstack/auth';
import { getCache, setCache } from '../../../src/services/redis';

jest.mock('axios', () => {
  return {
    create: jest.fn().mockReturnThis(),
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } }
  };
});
jest.mock('../../../src/services/redis');

const mockedAxios = axios as any;
const mockedGetCache = getCache as jest.MockedFunction<typeof getCache>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService({
      authUrl: 'http://test-keystone:5000/v3',
      username: 'test-user',
      password: 'test-password',
      projectName: 'test-project'
    });
  });

  it('should authenticate and return token info', async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedAxios.post.mockResolvedValue({
      headers: { 'x-subject-token': 'fake-token' },
      data: {
        token: {
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          catalog: []
        }
      }
    });

    const info = await authService.authenticate();
    expect(info.token).toBe('fake-token');
    expect(mockedAxios.post).toHaveBeenCalled();
  });
});
