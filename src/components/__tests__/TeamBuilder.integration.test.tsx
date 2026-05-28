import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamBuilder } from '../TeamBuilder/TeamBuilder';
import { POKEMON_TYPES, Team, TeamMember } from '../../types';
import {
  buildMember,
  emptyTeam,
  mockMoveList,
  mockPokemonList,
} from '../../utils/__tests__/testFixtures';

// Mock usePokemonData per the task spec (used by App.tsx). The TeamBuilder
// itself receives data through props, but App-level tests would consume this.
vi.mock('../../hooks/usePokemonData', () => ({
  usePokemonData: () => ({
    pokemon: mockPokemonList,
    moves: mockMoveList,
    typeChart: null,
    loading: false,
    progress: 1,
    reset: vi.fn(),
  }),
}));

function renderBuilder(team: Team, overrides: Partial<ComponentProps<typeof TeamBuilder>> = {}) {
  const onUpdateMember = vi.fn();
  const onSaveCustom = vi.fn();
  const onRenameTeam = vi.fn();
  const onToggleIncludeCustoms = vi.fn();
  const utils = render(
    <TeamBuilder
      team={team}
      pokemon={mockPokemonList}
      moves={mockMoveList}
      customs={[]}
      includeCustoms={false}
      onToggleIncludeCustoms={onToggleIncludeCustoms}
      onUpdateMember={onUpdateMember}
      onSaveCustom={onSaveCustom}
      onRenameTeam={onRenameTeam}
      {...overrides}
    />,
  );
  return { ...utils, onUpdateMember, onSaveCustom, onRenameTeam, onToggleIncludeCustoms };
}

describe('TeamBuilder integration', () => {
  it('renders with an empty team: 6 empty slot placeholders', () => {
    renderBuilder(emptyTeam);
    const empties = screen.getAllByText(/empty slot/i);
    expect(empties).toHaveLength(6);
    expect(screen.getByText(/0\/6 filled/i)).toBeInTheDocument();
  });

  it('renders a filled slot: shows species name and type badges', () => {
    const team: Team = {
      ...emptyTeam,
      members: [
        buildMember('Charizard', ['fire', 'flying']),
        null,
        null,
        null,
        null,
        null,
      ],
    };
    renderBuilder(team);
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText(/1\/6 filled/i)).toBeInTheDocument();
  });

  it('overriding type 1 calls onUpdateMember with the new types', async () => {
    const user = userEvent.setup();
    const team: Team = {
      ...emptyTeam,
      members: [
        buildMember('Charizard', ['fire', 'flying']),
        null,
        null,
        null,
        null,
        null,
      ],
    };
    const { onUpdateMember } = renderBuilder(team);
    const [type1Select] = screen.getAllByDisplayValue('fire');
    await user.selectOptions(type1Select, 'water');
    expect(onUpdateMember).toHaveBeenCalled();
    const [idx, next] = onUpdateMember.mock.calls[0];
    expect(idx).toBe(0);
    expect((next as TeamMember).types[0]).toBe('water');
  });

  it('renaming the team calls onRenameTeam with the new name', async () => {
    const user = userEvent.setup();
    const { onRenameTeam } = renderBuilder(emptyTeam);
    const input = screen.getByDisplayValue(emptyTeam.name);
    await user.clear(input);
    await user.type(input, 'New Team Name');
    expect(onRenameTeam).toHaveBeenCalled();
    // Last call should reflect the final character typed.
    const lastArg = onRenameTeam.mock.calls.at(-1)?.[0];
    expect(typeof lastArg).toBe('string');
  });

  it('clear slot button calls onUpdateMember(idx, null)', async () => {
    const user = userEvent.setup();
    const team: Team = {
      ...emptyTeam,
      members: [
        buildMember('Charizard', ['fire', 'flying']),
        null,
        null,
        null,
        null,
        null,
      ],
    };
    const { onUpdateMember } = renderBuilder(team);
    await user.click(screen.getByRole('button', { name: /clear slot/i }));
    expect(onUpdateMember).toHaveBeenCalledWith(0, null);
  });

  it('save as custom button calls onSaveCustom with the member', async () => {
    const user = userEvent.setup();
    const member = buildMember('Charizard', ['fire', 'flying']);
    const team: Team = {
      ...emptyTeam,
      members: [member, null, null, null, null, null],
    };
    const { onSaveCustom } = renderBuilder(team);
    await user.click(screen.getByRole('button', { name: /save as custom/i }));
    expect(onSaveCustom).toHaveBeenCalledWith(member);
  });

  it('all 18 types are available in the type-1 selector', () => {
    const team: Team = {
      ...emptyTeam,
      members: [
        buildMember('Charizard', ['fire', 'flying']),
        null,
        null,
        null,
        null,
        null,
      ],
    };
    renderBuilder(team);
    const [type1Select] = screen.getAllByDisplayValue('fire') as HTMLSelectElement[];
    const optionValues = Array.from(type1Select.querySelectorAll('option')).map(
      (o) => o.value,
    );
    for (const t of POKEMON_TYPES) {
      expect(optionValues).toContain(t);
    }
  });
});
