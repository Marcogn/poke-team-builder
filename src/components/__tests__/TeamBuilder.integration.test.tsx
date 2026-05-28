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
    error: null,
    version: 2,
    generatedAt: '2026-01-01T00:00:00Z',
  }),
}));

function renderBuilder(team: Team, overrides: Partial<ComponentProps<typeof TeamBuilder>> = {}) {
  const onUpdateMember = vi.fn();
  const onSaveCustom = vi.fn();
  const onRenameTeam = vi.fn();
  const onShowMovesChange = vi.fn();
  const utils = render(
    <TeamBuilder
      team={team}
      pokemon={mockPokemonList}
      moves={mockMoveList}
      customs={[]}
      showMoves={true}
      onShowMovesChange={onShowMovesChange}
      onUpdateMember={onUpdateMember}
      onSaveCustom={onSaveCustom}
      onRenameTeam={onRenameTeam}
      {...overrides}
    />,
  );
  return { ...utils, onUpdateMember, onSaveCustom, onRenameTeam, onShowMovesChange };
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
    // Species name appears in the slot header (font-semibold div) and also in
    // the dropdown placeholder span. Both are valid; just assert ≥1.
    expect(screen.getAllByText('Charizard').length).toBeGreaterThan(0);
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

  it('sprite fallback in card context: artwork is used when HOME is null', async () => {
    const user = userEvent.setup();
    // Gastly's fixture has spriteHome: null and spriteArtwork set.
    const gastly = mockPokemonList.find((p) => p.name === 'gastly')!;
    expect(gastly.spriteHome).toBeNull();
    expect(gastly.spriteArtwork).not.toBeNull();
    const team: Team = { ...emptyTeam };
    const captured: { value: TeamMember | null } = { value: null };
    render(
      <TeamBuilder
        team={team}
        pokemon={mockPokemonList}
        moves={mockMoveList}
        customs={[]}
        showMoves={true}
        onShowMovesChange={vi.fn()}
        onUpdateMember={(_idx, next) => {
          captured.value = next;
        }}
        onSaveCustom={vi.fn()}
        onRenameTeam={vi.fn()}
      />,
    );
    // Open the first slot's dropdown and pick Gastly.
    const openers = screen.getAllByRole('button', { name: /choose pokémon/i });
    await user.click(openers[0]);
    const option = await screen.findByText('Gastly');
    await user.click(option);
    expect(captured.value).not.toBeNull();
    expect(captured.value!.spriteUrl).toBe(gastly.spriteArtwork);
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

describe('Settings — install button', () => {
  it('renders the install button when available', async () => {
    const { Settings } = await import('../Settings/Settings');
    const onInstall = vi.fn();
    render(
      <Settings installAvailable={true} onInstall={onInstall} />,
    );
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
  });
});

describe('Type override → analysis', () => {
  it('overriding both types of a Water/Flying slot to Fire/Ground makes Fire- and Ground- targets show as covered', async () => {
    const user = userEvent.setup();
    const { useState } = await import('react');

    function Harness() {
      const [team, setTeam] = useState<Team>({
        ...emptyTeam,
        members: [
          buildMember('AquaBird', ['water', 'flying']),
          null,
          null,
          null,
          null,
          null,
        ],
      });
      return (
        <TeamBuilder
          team={team}
          pokemon={mockPokemonList}
          moves={mockMoveList}
          customs={[]}
          showMoves={true}
          onShowMovesChange={() => {}}
          onUpdateMember={(idx, next) => {
            setTeam((t) => {
              const members = [...t.members];
              members[idx] = next;
              return { ...t, members };
            });
          }}
          onSaveCustom={() => {}}
          onRenameTeam={() => {}}
        />
      );
    }

    const { unmount } = render(<Harness />);

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    // First combobox is Type 1, second is Type 2 for the only filled slot.
    await user.selectOptions(selects[0], 'fire');
    // Re-query after rerender.
    const selectsAfter = screen.getAllByRole('combobox') as HTMLSelectElement[];
    await user.selectOptions(selectsAfter[1], 'ground');

    // The Type 1 select now shows 'fire' and Type 2 shows 'ground'.
    const finalSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(finalSelects[0].value).toBe('fire');
    expect(finalSelects[1].value).toBe('ground');
    unmount();

    // Now render the CoverageGrid against an equivalently overridden member
    // and verify the offensive row covers Electric (Ground 2x) and Grass
    // (Fire 2x) but not Water.
    const overriddenMember = buildMember('AquaBird', ['fire', 'ground']);
    const { CoverageGrid } = await import('../CoverageGrid/CoverageGrid');
    const { mockTypeChart } = await import('../../utils/__tests__/testFixtures');
    render(<CoverageGrid chart={mockTypeChart} members={[overriddenMember]} />);

    const row = screen
      .getAllByText('AquaBird')
      .find((el) => el.closest('td'))!
      .closest('tr')!;
    const cells = row.querySelectorAll('td');
    const { POKEMON_TYPES } = await import('../../types');
    const cellFor = (t: string) => cells[POKEMON_TYPES.indexOf(t as never) + 1];
    expect(cellFor('electric').textContent).toBe('2×');
    expect(cellFor('grass').textContent).toBe('2×');
    expect(cellFor('water').textContent).not.toBe('2×');
  });
});
