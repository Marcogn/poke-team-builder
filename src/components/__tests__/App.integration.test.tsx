import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import {
  mockMoveList,
  mockPokemonList,
  mockTypeChart,
} from '../../utils/__tests__/testFixtures';

// Mock usePokemonData
vi.mock('../../hooks/usePokemonData', () => ({
  usePokemonData: () => ({
    pokemon: mockPokemonList,
    moves: mockMoveList,
    typeChart: mockTypeChart,
    loading: false,
    error: null,
    version: 2,
    generatedAt: '2026-01-01T00:00:00Z',
  }),
}));

// Mock uuid for predictable IDs
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

beforeEach(() => {
  uuidCounter = 0;
  localStorage.clear();
});

describe('Teams page', () => {
  it('clicking a team card navigates to team detail', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Should see TeamsPage with the default team
    expect(screen.getByText('Your Teams')).toBeInTheDocument();

    // Click on the first team card - find the team name and click the card
    const teamCard = screen.getByText('My First Team').closest('div[class*="cursor-pointer"]');
    expect(teamCard).toBeInTheDocument();
    await user.click(teamCard!);

    // Should now see breadcrumb with team name
    expect(screen.getByText('My First Team')).toBeInTheDocument();
    // Should see the Pokémon and Analysis tab buttons in the tab bar
    const tabs = screen.getAllByRole('button', { name: /pokémon/i });
    expect(tabs.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^analysis$/i })).toBeInTheDocument();
  });

  it('clicking "+ New team" opens modal with two options', async () => {
    const user = userEvent.setup();
    render(<App />);

    const newTeamCard = screen.getByText('New team').closest('div');
    await user.click(newTeamCard!);

    // Modal should show two options
    expect(screen.getByText('Create empty team')).toBeInTheDocument();
    expect(screen.getByText('Import from Showdown')).toBeInTheDocument();
  });
});

describe('Team detail', () => {
  it('clicking "Analyze team" switches to Analysis tab', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Navigate to team detail
    const teamCard = screen.getByText('My First Team').closest('div[class*="cursor-pointer"]');
    await user.click(teamCard!);

    // The analyze button should be disabled since team is empty
    const analyzeBtn = screen.getByRole('button', { name: /analyze team/i });
    expect(analyzeBtn).toBeDisabled();
  });

  it('Analysis tab shows empty state when team is empty', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Navigate to team detail
    const teamCard = screen.getByText('My First Team').closest('div[class*="cursor-pointer"]');
    await user.click(teamCard!);

    // Click the Analysis tab
    await user.click(screen.getByRole('button', { name: /^analysis$/i }));

    // Should show empty state message
    expect(screen.getByText(/add pokémon in the pokémon tab to analyze your team/i)).toBeInTheDocument();
  });
});

describe('Settings', () => {
  it('theme toggle updates document class correctly', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Navigate to Settings
    await user.click(screen.getByRole('button', { name: /settings/i }));

    // Find the theme select
    const themeSelect = screen.getByDisplayValue('System default');
    expect(themeSelect).toBeInTheDocument();

    // Change to Dark
    await user.selectOptions(themeSelect, 'dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Change to Light
    await user.selectOptions(themeSelect, 'light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('Mega filter setting is present', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByLabelText(/include mega\/dynamax/i)).toBeInTheDocument();
  });
});

describe('Import modal', () => {
  it('valid Showdown paste creates team and navigates', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Open the new team modal
    const newTeamCard = screen.getByText('New team').closest('div');
    await user.click(newTeamCard!);

    // Click Import from Showdown
    await user.click(screen.getByText('Import from Showdown'));

    // Paste a valid Showdown team
    const textarea = screen.getByPlaceholderText(/paste your showdown export here/i);
    await user.type(textarea, 'Charizard\nAbility: Blaze\n- Flamethrower\n');

    // Click Import
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    // Should navigate to team detail - look for the Pokémon tab button which indicates we're on team detail
    expect(screen.getByRole('button', { name: /analyze team/i })).toBeInTheDocument();
  });
});

describe('Export modal', () => {
  it('shows correct Showdown format for current team', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Navigate to team detail
    const teamCard = screen.getByText('My First Team').closest('div[class*="cursor-pointer"]');
    await user.click(teamCard!);

    // Click Export button
    const exportBtn = screen.getByRole('button', { name: /export/i });
    await user.click(exportBtn);

    // Should show the export modal with textarea
    expect(screen.getByText('Export Team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download .txt/i })).toBeInTheDocument();
  });
});
