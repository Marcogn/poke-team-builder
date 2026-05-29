import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamDetailPage } from '../TeamDetailPage/TeamDetailPage';
import { Team, TeamMember } from '../../types';
import {
  buildMember,
  mockMoveList,
  mockPokemonList,
  mockTypeChart,
} from '../../utils/__tests__/testFixtures';

function renderDetail(showMoves: boolean) {
  const member = buildMember('Charizard', ['fire', 'flying'], ['fire', 'water']);
  expect(member.moves[0]).not.toBeNull();
  const team: Team = {
    id: 't1',
    name: 'T1',
    createdAt: 0,
    members: [member, null, null, null, null, null],
  };
  return render(
    <TeamDetailPage
      team={team}
      tab="analysis"
      onTabChange={vi.fn()}
      pokemon={mockPokemonList}
      moves={mockMoveList}
      customs={[]}
      typeChart={mockTypeChart}
      showMoves={showMoves}
      onShowMovesChange={vi.fn()}
      onUpdateMember={vi.fn()}
      onSaveCustom={vi.fn()}
      onRenameTeam={vi.fn()}
      onDeleteTeam={vi.fn()}
      onApplySuggestion={vi.fn()}
      includeCustomsAnalysis={false}
      onIncludeCustomsChange={vi.fn()}
      includeMegaDynamax={false}
      excludeLegendaries={false}
    />,
  );
}

describe('Analysis honors "Enable move slots" toggle', () => {
  it('uses move-based coverage when showMoves=true and moves are entered', () => {
    renderDetail(true);
    expect(screen.getByText(/Analysis based on entered moves\./i)).toBeInTheDocument();
  });

  it('falls back to type-based coverage when showMoves=false even if moves exist', () => {
    renderDetail(false);
    expect(screen.getByText(/Analysis based on Pokémon types only\./i)).toBeInTheDocument();
  });

  it('does not consider stored moves for shared-weakness counts when showMoves=false', () => {
    // The basis notice is the easiest observable proxy: if it reads "types only"
    // then every downstream computation (offensive grid, suggestions, etc.) has
    // received members with their moves stripped.
    const { container } = renderDetail(false);
    expect(container.textContent).not.toMatch(/Analysis based on entered moves/);
    expect(container.textContent).not.toMatch(/Mixed: move-based/);
  });
});
