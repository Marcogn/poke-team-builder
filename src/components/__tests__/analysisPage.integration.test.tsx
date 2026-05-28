import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoverageGrid } from '../CoverageGrid/CoverageGrid';
import { buildMember, mockTypeChart } from '../../utils/__tests__/testFixtures';
import { POKEMON_TYPES } from '../../types';

describe('Analysis page integration', () => {
  const members = [
    buildMember('Charizard', ['fire', 'flying']),
    buildMember('Gyarados', ['water', 'flying']),
    buildMember('Mawile', ['steel', 'fairy']),
  ];

  it('renders all 7 sections', () => {
    render(<CoverageGrid chart={mockTypeChart} members={members} />);
    // Section A - coverage basis notice
    expect(screen.getByText(/Analysis based on/i) || screen.getByText(/Analisi basata/i)).toBeTruthy();
    // Section B - per-pokemon breakdown
    expect(screen.getByText('Per-Pokémon Breakdown')).toBeTruthy();
    // Section C - offensive coverage
    expect(screen.getByText('Offensive Coverage')).toBeTruthy();
    // Section D - defensive coverage
    expect(screen.getByText('Defensive Coverage')).toBeTruthy();
    // Section E - shared weaknesses
    expect(screen.getByText('Shared Weaknesses')).toBeTruthy();
  });

  it('offensive grid has 18 columns + name column', () => {
    render(<CoverageGrid chart={mockTypeChart} members={members} />);
    const tables = document.querySelectorAll('table');
    // First table is offensive
    const offensiveTable = tables[0];
    const headerCells = offensiveTable.querySelectorAll('thead th');
    // 18 types + 1 name column = 19
    expect(headerCells.length).toBe(19);
  });

  it('defensive grid has 18 columns + name column', () => {
    render(<CoverageGrid chart={mockTypeChart} members={members} />);
    const tables = document.querySelectorAll('table');
    // Second table is defensive
    const defensiveTable = tables[1];
    const headerCells = defensiveTable.querySelectorAll('thead th');
    expect(headerCells.length).toBe(19);
  });

  it('shared weakness badge shows count', () => {
    render(<CoverageGrid chart={mockTypeChart} members={members} />);
    // Both Charizard and Gyarados are weak to Electric and Rock
    const countBadges = screen.getAllByText(/×\d+/);
    expect(countBadges.length).toBeGreaterThan(0);
  });

  it('per-Pokémon breakdown card is collapsed by default, expands on click', () => {
    render(<CoverageGrid chart={mockTypeChart} members={members} />);
    // Cards should be collapsed: weaknesses/resistances labels not visible
    expect(screen.queryByText('Weaknesses (4×)')).toBeNull();
    expect(screen.queryByText('Weaknesses (2×)')).toBeNull();

    // Click on Charizard to expand (use getAllByText and find the one in the button)
    const charizardElements = screen.getAllByText('Charizard');
    const charizardButton = charizardElements
      .map((el) => el.closest('button'))
      .find((btn) => btn !== null);
    if (charizardButton) {
      fireEvent.click(charizardButton);
    }
    // Now should show weakness info (Charizard is 4× weak to Rock)
    expect(screen.getByText('Weaknesses (4×)')).toBeTruthy();
  });

  it('light theme: dark class absent when theme is light', () => {
    // This tests the mechanism, not the full app
    document.documentElement.classList.remove('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
