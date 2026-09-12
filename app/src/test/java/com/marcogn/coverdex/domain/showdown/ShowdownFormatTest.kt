package com.marcogn.coverdex.domain.showdown

import com.marcogn.coverdex.domain.buildMember
import com.marcogn.coverdex.domain.model.DamageClass
import com.marcogn.coverdex.domain.model.MoveEntry
import com.marcogn.coverdex.domain.model.PokemonEntry
import com.marcogn.coverdex.domain.model.PokemonType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Ports `legacy-web/src/utils/__tests__/showdownParser.test.ts` case by case, same expected
 * values. [resolveMove]/[resolveSpecies] mirror the TS test's own `resolveMove`/`resolveTypes`
 * fixtures, adapted to return the full [PokemonEntry] (see `ShowdownFormat.kt`'s doc comment for
 * why).
 */
class ShowdownFormatTest {

    private val mockMoves = listOf(
        MoveEntry(1, "tackle", "Tackle", PokemonType.NORMAL, 40, DamageClass.PHYSICAL),
        MoveEntry(2, "thunderbolt", "Thunderbolt", PokemonType.ELECTRIC, 90, DamageClass.SPECIAL),
        MoveEntry(3, "flamethrower", "Flamethrower", PokemonType.FIRE, 90, DamageClass.SPECIAL),
        MoveEntry(4, "earthquake", "Earthquake", PokemonType.GROUND, 100, DamageClass.PHYSICAL),
        MoveEntry(5, "dragon-claw", "Dragon Claw", PokemonType.DRAGON, 80, DamageClass.PHYSICAL),
        MoveEntry(6, "surf", "Surf", PokemonType.WATER, 90, DamageClass.SPECIAL),
    )

    private fun resolveMove(name: String): MoveEntry? {
        val key = name.lowercase().replace(Regex("\\s+"), "-")
        return mockMoves.find { it.name == key }
    }

    private fun resolveSpecies(speciesName: String): PokemonEntry? {
        val (id, types) = when (speciesName.lowercase()) {
            "pikachu" -> 25 to (PokemonType.ELECTRIC to null)
            "charizard" -> 6 to (PokemonType.FIRE to PokemonType.FLYING)
            "snorlax" -> 143 to (PokemonType.NORMAL to null)
            else -> return null
        }
        return PokemonEntry(
            id = id, name = speciesName.lowercase(), displayName = speciesName, speciesId = id, speciesName = speciesName.lowercase(),
            types = types, isLegendary = false, isMythical = false, isFinalEvolution = true,
            generationIntroduced = 1, defaultAbility = null, isDefaultForm = true,
        )
    }

    // ---- export ----

    @Test
    fun `exports a complete team member with all fields`() {
        val m = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING, listOf(PokemonType.FIRE, PokemonType.GROUND, PokemonType.DRAGON, PokemonType.FIRE))
        val out = exportMemberToShowdown(m)
        assertTrue(out.startsWith("Charizard @"))
        assertTrue(out.contains("Ability:"))
        assertTrue(out.contains("- fire-move"))
        assertTrue(out.contains("# Types: fire/flying"))
    }

    @Test
    fun `never emits blank EVs or Nature lines, real Showdown omits them when unset`() {
        val m = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING, listOf(PokemonType.FIRE))
        val out = exportMemberToShowdown(m)
        assertTrue(out.lines().none { it.startsWith("EVs:") })
        assertTrue(out.lines().none { it.trim() == "Nature" || it.endsWith(" Nature") })
    }

    @Test
    fun `exports a member with null moves, placeholders skipped`() {
        val m = buildMember("Snorlax", PokemonType.NORMAL to null)
        val out = exportMemberToShowdown(m)
        assertTrue(out.lines().none { it.startsWith("- ") })
        assertTrue(out.contains("# Types: normal"))
    }

    @Test
    fun `exports a full team separated by blank lines`() {
        val m1 = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING)
        val m2 = buildMember("Snorlax", PokemonType.NORMAL to null)
        val out = exportTeamToShowdown(listOf(m1, null, m2, null, null, null))
        assertEquals(2, out.split(Regex("\n\\s*\n")).size)
    }

    // ---- import ----

    @Test
    fun `imports a standard Showdown paste with all fields`() {
        val paste = listOf(
            "Charizard @ Charcoal",
            "Ability: Blaze",
            "EVs: 4 HP / 252 SpA / 252 Spe",
            "Modest Nature",
            "- Flamethrower",
            "- Earthquake",
            "- Dragon Claw",
            "- Surf",
        ).joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertTrue(imp.speciesKnown)
        assertEquals("Charizard", imp.member.speciesName)
        assertEquals(PokemonType.FIRE to PokemonType.FLYING, imp.member.types)
        assertEquals(4, imp.member.moves.filterNotNull().size)
        assertEquals(emptyList<String>(), imp.unknownMoveNames)
        assertEquals("Charcoal", imp.member.item)
    }

    @Test
    fun `imports with missing optional fields, no item no EVs`() {
        val paste = listOf("Pikachu", "- Thunderbolt", "- Tackle").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertEquals("Pikachu", imp.member.speciesName)
        assertEquals(PokemonType.ELECTRIC to null, imp.member.types)
        assertEquals("Thunderbolt", imp.member.moves[0]?.name)
        assertNull(imp.member.moves[2])
    }

    @Test
    fun `flags an unknown custom move`() {
        val paste = listOf("Pikachu", "- Made Up Move").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertEquals(listOf("Made Up Move"), imp.unknownMoveNames)
        assertTrue(imp.member.moves[0]?.isCustom == true)
    }

    @Test
    fun `imports a 6-member block`() {
        fun block(name: String, move: String) = listOf("$name @ ", "Ability: ", "- $move").joinToString("\n")
        val text = listOf(
            block("Pikachu", "Thunderbolt"),
            block("Charizard", "Flamethrower"),
            block("Snorlax", "Tackle"),
            block("Pikachu", "Thunderbolt"),
            block("Charizard", "Flamethrower"),
            block("Snorlax", "Tackle"),
        ).joinToString("\n\n")
        val imps = parseShowdownTeam(text, ::resolveMove, ::resolveSpecies)
        assertEquals(6, imps.size)
    }

    @Test
    fun `round-trip export then re-import preserves species types and move names`() {
        val original = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING, listOf(PokemonType.FIRE, PokemonType.GROUND))
        val text = exportMemberToShowdown(original)
        val imp = parseShowdownBlock(text, ::resolveMove, ::resolveSpecies)
        assertEquals("Charizard", imp.member.speciesName)
        assertEquals(PokemonType.FIRE to PokemonType.FLYING, imp.member.types)
        val moveNames = imp.member.moves.filterNotNull().map { it.name }
        assertEquals(listOf("fire-move", "ground-move"), moveNames)
    }

    @Test
    fun `handles empty string without crashing`() {
        assertEquals(emptyList<ImportedMember>(), parseShowdownTeam("", ::resolveMove, ::resolveSpecies))
    }

    @Test
    fun `handles garbage text by yielding an unknown-species block`() {
        val result = parseShowdownTeam("asdf qwer\nzxcv", ::resolveMove, ::resolveSpecies)
        assertEquals(1, result.size)
        assertTrue(!result[0].speciesKnown)
    }

    @Test
    fun `handles partial block species only without crashing`() {
        val result = parseShowdownTeam("Pikachu", ::resolveMove, ::resolveSpecies)
        assertEquals(1, result.size)
        assertTrue(result[0].speciesKnown)
        assertTrue(result[0].member.moves.all { it == null })
    }

    // ---- unknown species handling ----

    @Test
    fun `importShowdownTeam unknown species yields no slot but an error entry`() {
        val text = listOf("Fakemon @ ", "Ability: ", "- Tackle").joinToString("\n")
        val result = importShowdownTeam(text, ::resolveMove, ::resolveSpecies)
        assertEquals(0, result.members.size)
        assertEquals(listOf(ImportError("Fakemon")), result.errors)
    }

    @Test
    fun `importShowdownTeam 3-block paste with one unknown, slots 1 and 3 imported`() {
        fun block(name: String, move: String) = listOf("$name @ ", "Ability: ", "- $move").joinToString("\n")
        val text = listOf(
            block("Pikachu", "Thunderbolt"),
            block("Fakemon", "Tackle"),
            block("Charizard", "Flamethrower"),
        ).joinToString("\n\n")
        val result = importShowdownTeam(text, ::resolveMove, ::resolveSpecies)
        assertEquals(listOf("Pikachu", "Charizard"), result.members.map { it.member.speciesName })
        assertEquals(1, result.errors.size)
        assertEquals("Fakemon", result.errors[0].speciesName)
    }

    // ---- ability handling ----

    @Test
    fun `parses ability line and populates member ability`() {
        val paste = listOf(
            "Charizard @ Charcoal",
            "Ability: Flash Fire",
            "EVs: 252 SpA / 252 Spe",
            "Modest Nature",
            "- Flamethrower",
        ).joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertEquals("Flash Fire", imp.member.ability)
    }

    @Test
    fun `exports ability line when ability is set`() {
        val m = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING, listOf(PokemonType.FIRE), ability = "Blaze")
        val out = exportMemberToShowdown(m)
        assertTrue(out.contains("Ability: Blaze"))
    }

    @Test
    fun `omits the Ability line entirely when ability is null, matches real Showdown`() {
        val m = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING)
        val out = exportMemberToShowdown(m)
        assertTrue(out.lines().none { it.startsWith("Ability:") })
    }

    @Test
    fun `round-trip export with ability then re-import preserves ability`() {
        val original = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING, listOf(PokemonType.FIRE), ability = "Solar Power")
        val text = exportMemberToShowdown(original)
        val imp = parseShowdownBlock(text, ::resolveMove, ::resolveSpecies)
        assertEquals("Solar Power", imp.member.ability)
    }

    @Test
    fun `missing ability line, backward compat, member ability is null`() {
        val paste = listOf("Pikachu", "- Thunderbolt").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertNull(imp.member.ability)
    }

    @Test
    fun `empty ability value, member ability is null`() {
        val paste = listOf("Pikachu", "Ability: ", "- Thunderbolt").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertNull(imp.member.ability)
    }

    // ---- item handling (Phase 7 — phase-7-accuracy-and-customization.md §4.3) ----

    @Test
    fun `parses the item from the species line's @ suffix`() {
        val paste = listOf("Charizard @ Air Balloon", "Ability: Blaze", "- Flamethrower").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertEquals("Air Balloon", imp.member.item)
    }

    @Test
    fun `exports Species @ Item when an item is set`() {
        val m = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING).copy(item = "Charcoal")
        val out = exportMemberToShowdown(m)
        assertTrue(out.lines().first() == "Charizard @ Charcoal")
    }

    @Test
    fun `exports the bare species line with no trailing at-sign when no item is set`() {
        val m = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING)
        val out = exportMemberToShowdown(m)
        assertTrue(out.lines().first() == "Charizard")
    }

    @Test
    fun `round-trip export with an item then re-import preserves it`() {
        val original = buildMember("Charizard", PokemonType.FIRE to PokemonType.FLYING).copy(item = "Life Orb")
        val text = exportMemberToShowdown(original)
        val imp = parseShowdownBlock(text, ::resolveMove, ::resolveSpecies)
        assertEquals("Life Orb", imp.member.item)
    }

    @Test
    fun `no @ on the species line at all, member item is null`() {
        val paste = listOf("Pikachu", "- Thunderbolt").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertNull(imp.member.item)
    }

    @Test
    fun `empty item value after @, member item is null`() {
        val paste = listOf("Pikachu @ ", "- Thunderbolt").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertNull(imp.member.item)
    }

    // ---- real Showdown compatibility (verified against sim/teams.ts in
    // smogon/pokemon-showdown) — a genuine paste from the real client commonly includes lines
    // this app doesn't model (Level, Tera Type, Shiny, ...); those must never be mistaken for
    // the species line, which is always the block's first line only. ----

    @Test
    fun `a real Showdown paste with Level and Tera Type does not corrupt the species`() {
        val paste = listOf(
            "Charizard @ Choice Scarf",
            "Ability: Blaze",
            "Level: 50",
            "Shiny: Yes",
            "Tera Type: Water",
            "EVs: 252 Atk / 4 Def / 252 Spe",
            "Jolly Nature",
            "- Flamethrower",
            "- Earthquake",
        ).joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertTrue(imp.speciesKnown)
        assertEquals("Charizard", imp.member.speciesName)
        assertEquals("Blaze", imp.member.ability)
        assertEquals("Choice Scarf", imp.member.item)
    }

    @Test
    fun `Happiness, Pokeball, Hidden Power and Dynamax Level lines are ignored, not treated as species`() {
        val paste = listOf(
            "Snorlax @ Leftovers",
            "Happiness: 0",
            "Pokeball: Friend Ball",
            "Hidden Power: Ice",
            "Dynamax Level: 10",
            "Gigantamax: Yes",
            "- Tackle",
        ).joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertTrue(imp.speciesKnown)
        assertEquals("Snorlax", imp.member.speciesName)
    }

    @Test
    fun `strips a nickname wrapper from the species line, real Showdown nickname format`() {
        val paste = listOf("Volt Turtle (Pikachu) @ Light Ball", "- Thunderbolt").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertTrue(imp.speciesKnown)
        assertEquals("Pikachu", imp.member.speciesName)
        assertEquals("Light Ball", imp.member.item)
    }

    @Test
    fun `strips a trailing gender marker from the species line`() {
        val paste = listOf("Pikachu (F) @ Light Ball", "- Thunderbolt").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertTrue(imp.speciesKnown)
        assertEquals("Pikachu", imp.member.speciesName)
    }

    @Test
    fun `Trait line is a legacy alias for Ability`() {
        val paste = listOf("Charizard", "Trait: Blaze", "- Flamethrower").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertEquals("Blaze", imp.member.ability)
    }

    @Test
    fun `an unrecognized non-first line is ignored rather than overwriting the species`() {
        val paste = listOf("Pikachu @ Light Ball", "totally unrecognized junk", "- Thunderbolt").joinToString("\n")
        val imp = parseShowdownBlock(paste, ::resolveMove, ::resolveSpecies)
        assertTrue(imp.speciesKnown)
        assertEquals("Pikachu", imp.member.speciesName)
    }
}
