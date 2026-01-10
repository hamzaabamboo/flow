import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '../settings/+Page';
import { SpaceContext, SpaceContextType } from '../../contexts/SpaceContext';
import { ToasterContext } from '../../contexts/ToasterContext';
import { api } from '../../api/client';

// Mock API client
vi.mock('../../api/client', () => ({
  api: {
    api: {
      settings: {
        get: vi.fn(),
        patch: vi.fn(),
        'test-summary': {
          post: vi.fn()
        }
      },
      notes: {
        collections: {
          get: vi.fn()
        }
      },
      calendar: {
        'feed-url': {
          get: vi.fn()
        }
      },
      'api-tokens': vi.fn(),
      'external-calendars': vi.fn()
    }
  }
}));

interface MockEndpoint extends Mock {
  get?: Mock;
  post?: Mock;
  patch?: Mock;
  delete?: Mock;
}

// Setup chained mocks
const mockApiTokensDelete = vi.fn();
const mockApiTokensPost = vi.fn();
const mockApiTokensGet = vi.fn();
(api.api['api-tokens'] as unknown as MockEndpoint).get = mockApiTokensGet;
(api.api['api-tokens'] as unknown as MockEndpoint).post = mockApiTokensPost;
(api.api['api-tokens'] as unknown as MockEndpoint).mockImplementation(() => ({
  delete: mockApiTokensDelete
}));

const mockExternalCalendarsPatch = vi.fn();
const mockExternalCalendarsDelete = vi.fn();
const mockExternalCalendarsPost = vi.fn();
const mockExternalCalendarsGet = vi.fn();
(api.api['external-calendars'] as unknown as MockEndpoint).get = mockExternalCalendarsGet;
(api.api['external-calendars'] as unknown as MockEndpoint).post = mockExternalCalendarsPost;
(api.api['external-calendars'] as unknown as MockEndpoint).mockImplementation(() => ({
  patch: mockExternalCalendarsPatch,
  delete: mockExternalCalendarsDelete
}));

const mockSpaceContext: SpaceContextType = {
  currentSpace: 'work',
  setCurrentSpace: vi.fn(),
  toggleSpace: vi.fn()
};

const mockToasterContext = {
  toast: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false }
  }
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={mockSpaceContext}>
        <ToasterContext.Provider value={mockToasterContext}>{ui}</ToasterContext.Provider>
      </SpaceContext.Provider>
    </QueryClientProvider>
  );
};

const mockSettings = {
  theme: 'auto',
  defaultSpace: 'work',
  pomodoroSettings: {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4
  },
  notifications: {
    enabled: true,
    reminders: true,
    pomodoroComplete: true,
    taskDue: true,
    morningSummary: true,
    eveningSummary: true,
    summarySpaces: ['work']
  },
  integrations: {
    hambot: true,
    github: false,
    slack: false
  },
  outlineApiUrl: 'http://outline.test',
  outlineApiKey: 'test-key',
  outlineCollectionId: 'coll-1'
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Default mock responses
    (api.api.settings.get as Mock).mockResolvedValue({ data: mockSettings, error: null });
    (api.api.notes.collections.get as Mock).mockResolvedValue({
      data: { data: [{ id: 'coll-1', name: 'Collection 1' }] },
      error: null
    });
    (api.api.calendar['feed-url'].get as Mock).mockResolvedValue({
      data: { url: 'http://cal.feed' },
      error: null
    });
    mockApiTokensGet.mockResolvedValue({ data: [], error: null });
    mockExternalCalendarsGet.mockResolvedValue({ data: [], error: null });
  });

  it('should render loading state initially', () => {
    (api.api.settings.get as Mock).mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText(/Loading settings.../i)).toBeInTheDocument();
  });

  it('should render settings content', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Calendar Integration')).toBeInTheDocument();
    expect(screen.getByText('External Calendars')).toBeInTheDocument();
    expect(screen.getByText('API Tokens')).toBeInTheDocument();
    expect(screen.getByText('Outline Integration')).toBeInTheDocument();
  });

  it('should handle API token creation', async () => {
    const user = userEvent.setup();
    mockApiTokensPost.mockResolvedValue({ data: { token: 'new-test-token' }, error: null });

    renderWithProviders(<SettingsPage />);
    await screen.findByText('API Tokens');

    await user.click(screen.getByRole('button', { name: /Create Token/i }));

    // The dialog should be open now
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByPlaceholderText(/My Raycast Extension/i);
    await user.type(input, 'New Token Name');

    await user.click(within(dialog).getByRole('button', { name: 'Create Token' }));

    expect(mockApiTokensPost).toHaveBeenCalledWith({ name: 'New Token Name' });
    expect(await screen.findByText('Your new API token')).toBeInTheDocument();
    expect(screen.getByDisplayValue('new-test-token')).toBeInTheDocument();
  });

  it('should handle external calendar addition', async () => {
    const user = userEvent.setup();
    mockExternalCalendarsPost.mockResolvedValue({ data: { id: 'cal-1' }, error: null });

    renderWithProviders(<SettingsPage />);
    await screen.findByText('External Calendars');

    await user.click(screen.getByRole('button', { name: /Add Calendar/i }));

    // Find the Add dialog specifically (the one with Title "Add External Calendar")
    const dialogs = await screen.findAllByRole('dialog');
    const addDialog = dialogs.find((d) => within(d).queryByText('Add External Calendar'));

    if (!addDialog) throw new Error('Add dialog not found');

    await user.type(within(addDialog).getByPlaceholderText(/Work Calendar/i), 'My Calendar');
    await user.type(
      within(addDialog).getByPlaceholderText(/https:\/\/calendar\.google\.com/i),
      'http://test.com/cal.ics'
    );

    await user.click(within(addDialog).getByRole('button', { name: 'Add Calendar' }));

    expect(mockExternalCalendarsPost).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Calendar',
        icalUrl: 'http://test.com/cal.ics'
      })
    );
  });

  it('should list and delete external calendar', async () => {
    const user = userEvent.setup();
    const mockCals = [
      {
        id: 'cal-1',
        name: 'Work Cal',
        icalUrl: 'http://url',
        enabled: true,
        space: 'work',
        color: 'blue'
      }
    ];
    mockExternalCalendarsGet.mockResolvedValue({ data: mockCals, error: null });
    mockExternalCalendarsDelete.mockResolvedValue({ data: {}, error: null });

    renderWithProviders(<SettingsPage />);

    expect(await screen.findByText('Work Cal')).toBeInTheDocument();

    // The trash button is in the row with 'Work Cal'
    const buttons = screen.getAllByRole('button');
    const trashBtn = buttons.find((b) => b.innerHTML.includes('lucide-trash-2'));

    if (trashBtn) {
      await user.click(trashBtn);
      expect(mockExternalCalendarsDelete).toHaveBeenCalled();
    } else {
      throw new Error('Trash button not found');
    }
  });

  it('should save Outline settings', async () => {
    const user = userEvent.setup();
    (api.api.settings.patch as Mock).mockResolvedValue({ data: {}, error: null });

    renderWithProviders(<SettingsPage />);
    await screen.findByText('Outline Integration');

    const urlInput = screen.getByPlaceholderText(/https:\/\/app\.getoutline\.com/i);
    const keyInput = screen.getByPlaceholderText(/Enter your Outline API key/i);

    await user.clear(urlInput);
    await user.type(urlInput, 'http://new-outline.com');
    await user.clear(keyInput);
    await user.type(keyInput, 'new-key');

    await user.click(screen.getByRole('button', { name: /Save Outline Settings/i }));

    expect(api.api.settings.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        outlineApiUrl: 'http://new-outline.com',
        outlineApiKey: 'new-key'
      })
    );
  });

  it('should toggle evening summary and summary spaces', async () => {
    const user = userEvent.setup();
    (api.api.settings.patch as Mock).mockResolvedValue({ data: {}, error: null });

    renderWithProviders(<SettingsPage />);
    await screen.findByText('Daily Summaries (HamBot)');

    // Toggle Evening summary
    const switches = screen.getAllByRole('checkbox');
    // Index 4 should be Evening Summary
    await user.click(switches[4]);
    expect(api.api.settings.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.objectContaining({ eveningSummary: false })
      })
    );

    // Toggle Personal space
    const personalBtn = screen.getByRole('button', { name: /Personal/i });
    await user.click(personalBtn);
    expect(api.api.settings.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.objectContaining({ summarySpaces: ['work', 'personal'] })
      })
    );
  });

  it('should test HamBot summaries', async () => {
    const user = userEvent.setup();
    const testSummaryPost = api.api.settings['test-summary'].post as Mock;
    testSummaryPost.mockResolvedValue({ data: { message: 'Sent!' }, error: null });

    renderWithProviders(<SettingsPage />);
    await screen.findByText('Daily Summaries (HamBot)');

    await user.click(screen.getByRole('button', { name: /Morning/i }));
    expect(testSummaryPost).toHaveBeenCalledWith(expect.objectContaining({ type: 'morning' }));

    await user.click(screen.getByRole('button', { name: /Evening/i }));
    expect(testSummaryPost).toHaveBeenCalledWith(expect.objectContaining({ type: 'evening' }));
  });

  it('should handle external calendar editing', async () => {
    const user = userEvent.setup();
    const mockCal = {
      id: 'cal-1',
      name: 'Work Cal',
      icalUrl: 'http://url',
      enabled: true,
      space: 'work',
      color: 'blue'
    };
    mockExternalCalendarsGet.mockResolvedValue({ data: [mockCal], error: null });
    mockExternalCalendarsPatch.mockResolvedValue({ data: {}, error: null });

    renderWithProviders(<SettingsPage />);
    await screen.findByText('Work Cal');

    // Find edit button (pencil icon)
    const editBtn = screen
      .getAllByRole('button')
      .find((b) => b.innerHTML.includes('lucide-pencil'));
    await user.click(editBtn!);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit External Calendar')).toBeInTheDocument();

    const nameInput = within(dialog).getByDisplayValue('Work Cal');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    await user.click(within(dialog).getByRole('button', { name: 'Update Calendar' }));

    expect(mockExternalCalendarsPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Name'
      })
    );
  });

  it('should reset Outline settings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Outline Integration');

    const urlInput = screen.getByPlaceholderText(/https:\/\/app\.getoutline\.com/i);
    await user.type(urlInput, 'something random');

    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    await user.click(resetBtn);

    expect(urlInput).toHaveValue(mockSettings.outlineApiUrl);
  });
});
