import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamBuilder } from '../../components/TeamBuilder/TeamBuilder';
import { PokemonSlot } from '../../components/PokemonSlot/PokemonSlot';
import {
  buildMember,
  emptyTeam,
  mockMoveList,
  mockPokemonList,
} from '../../utils/__tests__/testFixtures';
import { Team, TeamMember } from '../../types';

describe('showMoves toggle', () => {
  it('move slots are NOT rendered when showMoves is false', () => {
    const team: Team = {
      ...emptyTeam,
      members: [
        buildMember('Charizard', ['fire', 'flying'], ['fire']),
        null,
        null,
        null,
        null,
        null,
      ],
    };
    const { container } = render(
      <TeamBuilder
        team={team}
        pokemon={mockPokemonList}
        moves={mockMoveList}
        customs={[]}
        showMoves={false}
        onShowMovesChange={vi.fn()}
        onUpdateMember={vi.fn()}
        onSaveCustom={vi.fn()}
        onRenameTeam={vi.fn()}
      />,
    );
    // Move slots should not exist
    const moveDropdowns = container.querySelectorAll('[data-testid="move-slot"]');
    // Since we don't use data-testid, look for move-related UI. MoveSlot renders
    // a SearchableDropdown or "Add move" text. Let's check none of that is present.
    expect(screen.queryByText(/add move/i)).not.toBeInTheDocument();
  });

  it('move slots ARE rendered when showMoves is true', () => {
    const team: Team = {
      ...emptyTeam,
      members: [
        buildMember('Charizard', ['fire', 'flying'], ['fire']),
        null,
        null,
        null,
        null,
        null,
      ],
    };
    render(
      <TeamBuilder
        team={team}
        pokemon={mockPokemonList}
        moves={mockMoveList}
        customs={[]}
        showMoves={true}
        onShowMovesChange={vi.fn()}
        onUpdateMember={vi.fn()}
        onSaveCustom={vi.fn()}
        onRenameTeam={vi.fn()}
      />,
    );
    // When showMoves is true and a member has a move, we should see some move-related UI
    // The MoveSlot renders a button to remove or the SearchableDropdown
    expect(screen.getByText(/fire-move/i)).toBeInTheDocument();
  });

  it('move data is preserved through toggle off → on', () => {
    const member = buildMember('Charizard', ['fire', 'flying'], ['fire', 'water']);
    expect(member.moves[0]).not.toBeNull();
    expect(member.moves[1]).not.toBeNull();

    const team: Team = {
      ...emptyTeam,
      members: [member, null, null, null, null, null],
    };

    // Render with showMoves=false
    const onUpdate = vi.fn();
    const { rerender } = render(
      <TeamBuilder
        team={team}
        pokemon={mockPokemonList}
        moves={mockMoveList}
        customs={[]}
        showMoves={false}
        onShowMovesChange={vi.fn()}
        onUpdateMember={onUpdate}
        onSaveCustom={vi.fn()}
        onRenameTeam={vi.fn()}
      />,
    );

    // Moves should not be rendered but data unchanged
    expect(screen.queryByText(/fire-move/i)).not.toBeInTheDocument();

    // Re-render with showMoves=true
    rerender(
      <TeamBuilder
        team={team}
        pokemon={mockPokemonList}
        moves={mockMoveList}
        customs={[]}
        showMoves={true}
        onShowMovesChange={vi.fn()}
        onUpdateMember={onUpdate}
        onSaveCustom={vi.fn()}
        onRenameTeam={vi.fn()}
      />,
    );

    // Moves should be visible again
    expect(screen.getByText(/fire-move/i)).toBeInTheDocument();
    expect(screen.getByText(/water-move/i)).toBeInTheDocument();
  });

  it('empty slots do not show move inputs even when showMoves is true', () => {
    render(
      <TeamBuilder
        team={emptyTeam}
        pokemon={mockPokemonList}
        moves={mockMoveList}
        customs={[]}
        showMoves={true}
        onShowMovesChange={vi.fn()}
        onUpdateMember={vi.fn()}
        onSaveCustom={vi.fn()}
        onRenameTeam={vi.fn()}
      />,
    );
    // All slots are "Empty slot", no move UI rendered
    const empties = screen.getAllByText(/empty slot/i);
    expect(empties).toHaveLength(6);
  });
});
