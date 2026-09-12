package com.marcogn.coverdex.domain.showdown

import com.marcogn.coverdex.domain.model.DamageClass
import com.marcogn.coverdex.domain.model.MoveEntry
import com.marcogn.coverdex.domain.model.PokemonEntry
import com.marcogn.coverdex.domain.model.PokemonMove
import com.marcogn.coverdex.domain.model.PokemonType
import com.marcogn.coverdex.domain.model.TeamMember
import java.util.UUID

/**
 * A direct port of `legacy-web/src/utils/showdownParser.ts` — same function names, same contract
 * (`docs/plan/native-spec.md`, "Showdown format contract"). **External users may rely on
 * round-tripping**, so this is a contract, not an implementation: change the written/read shape
 * only with a deliberate, documented reason. One such reason already applied: real compatibility
 * with Pokémon Showdown's own text format (verified against `sim/teams.ts` in
 * smogon/pokemon-showdown) — see `docs/implementation-decisions.md`, "Showdown format
 * compatibility", for what was wrong before and why.
 *
 * Both resolver parameters are plain, synchronous lookups rather than `PokedexRepository` calls
 * directly, keeping this file Android-free and unit-testable on the plain JVM — the caller
 * resolves them ahead of time (e.g. from an already-loaded `allSpecies()`/a single `moveByName`
 * call) and passes in a closure. [resolveSpecies] returns the full [PokemonEntry], not just its
 * types like the TypeScript's `resolveTypes`: this app resolves a sprite from
 * [TeamMember.pokedexId], never a stored URL, so the id has to come back from resolution too, not
 * only the types.
 */

private fun makeUnknownMove(name: String): PokemonMove = PokemonMove(
    id = UUID.randomUUID().toString(),
    name = name,
    type = PokemonType.NORMAL,
    power = null,
    damageClass = DamageClass.STATUS,
    isCustom = true,
)

private fun MoveEntry.toPokemonMove(): PokemonMove = PokemonMove(
    id = UUID.randomUUID().toString(),
    name = displayName,
    type = type,
    power = power,
    damageClass = damageClass,
    isCustom = false,
)

/** Convert a [TeamMember] to a Showdown-style block, matching the real client's own `exportSet`
 * grammar (`sim/teams.ts` in smogon/pokemon-showdown: a field's line is omitted entirely when
 * unset, never written blank) so the output pastes cleanly into Pokémon Showdown itself.
 * [TeamMember.item] round-trips as the standard `Species @ Item` line (Phase 7 — see
 * docs/plan/phase-7-accuracy-and-customization.md §4.3). EVs, IVs and nature are still untracked
 * and simply omitted, exactly as real Showdown omits them for a set with no EVs/IVs/nature set. */
fun exportMemberToShowdown(m: TeamMember): String {
    val lines = mutableListOf<String>()
    lines += if (m.item != null) "${m.speciesName} @ ${m.item}" else m.speciesName
    if (m.ability != null) lines += "Ability: ${m.ability}"
    m.moves.forEach { mv -> if (mv != null) lines += "- ${mv.name}" }
    // Include the typing as a comment so a round-trip preserves type overrides. Real Showdown's
    // parser only recognizes known line prefixes and silently ignores anything else, so this is
    // safe to paste into the real client too.
    val typesStr = listOfNotNull(m.types.first, m.types.second).joinToString("/") { it.apiName }
    lines += "# Types: $typesStr"
    return lines.joinToString("\n")
}

fun exportTeamToShowdown(members: List<TeamMember?>): String =
    members.filterNotNull().joinToString("\n\n") { exportMemberToShowdown(it) }

data class ImportedMember(
    val member: TeamMember,
    /** Move names the user must complete (type/power) — resolution failed, so a placeholder
     * stands in and the block still imports. */
    val unknownMoveNames: List<String>,
    /** `false` means the caller should skip this block. */
    val speciesKnown: Boolean,
    /** The raw species name as parsed, regardless of [speciesKnown]. */
    val speciesName: String,
)

private val EVS_IVS_NATURE_REGEX = Regex("EVs:|IVs:|Nature", RegexOption.IGNORE_CASE)
private val ABILITY_LINE_REGEX = Regex("^(Ability|Trait):\\s*", RegexOption.IGNORE_CASE)

/**
 * Line prefixes real Pokémon Showdown's own `exportSet`/`parseExportedTeamLine`
 * (`sim/teams.ts` in smogon/pokemon-showdown) recognizes for fields this app doesn't track.
 * Must be checked so these common real-Showdown-paste lines are dropped rather than
 * mistaken for the species line — see the "species line" branch below.
 */
private val IGNORED_DETAIL_PREFIXES = listOf(
    "level:", "shiny:", "happiness:", "pokeball:", "hidden power:",
    "dynamax level:", "gigantamax:", "tera type:",
)

/** Parse a single Showdown block into a [TeamMember]. */
fun parseShowdownBlock(
    block: String,
    resolveMove: (String) -> MoveEntry?,
    resolveSpecies: (String) -> PokemonEntry?,
): ImportedMember {
    val lines = block.split(Regex("\r?\n")).map { it.trim() }.filter { it.isNotEmpty() }
    var speciesName = "Unknown"
    var overrideTypes: Pair<PokemonType, PokemonType?>? = null
    var ability: String? = null
    var item: String? = null
    val moves = arrayOfNulls<PokemonMove>(4)
    var moveIdx = 0
    val unknown = mutableListOf<String>()

    lines.forEachIndexed { index, line ->
        val lower = line.lowercase()
        when {
            // Only the block's first line is ever the species line — matches real Showdown's
            // own `isFirstLine` handling. Any *other* unrecognized line (a field this app
            // doesn't model, or genuine garbage) is simply ignored rather than clobbering the
            // species already parsed, exactly like the real client does.
            index == 0 -> {
                var speciesLine = line.substringBefore("@").trim()
                if (line.contains("@")) {
                    val itemValue = line.substringAfter("@").trim()
                    if (itemValue.isNotEmpty()) item = itemValue
                }
                // Strip a trailing gender marker, then a "Nickname (Species)" wrapper — same
                // order and shape as real Showdown's own first-line parsing.
                if (speciesLine.endsWith(" (M)") || speciesLine.endsWith(" (F)")) {
                    speciesLine = speciesLine.dropLast(4)
                }
                if (speciesLine.endsWith(")") && speciesLine.contains("(")) {
                    speciesLine = speciesLine.dropLast(1).substringAfter("(").trim()
                }
                if (speciesLine.isNotEmpty()) speciesName = speciesLine
            }
            line.startsWith("- ") -> {
                val moveName = line.substring(2).trim()
                val known = resolveMove(moveName)
                val mv = if (known != null) {
                    known.toPokemonMove()
                } else {
                    unknown += moveName
                    makeUnknownMove(moveName)
                }
                if (moveIdx < 4) moves[moveIdx++] = mv
            }
            lower.startsWith("ability:") || lower.startsWith("trait:") -> {
                val value = line.replaceFirst(ABILITY_LINE_REGEX, "").trim()
                if (value.isNotEmpty()) ability = value
            }
            EVS_IVS_NATURE_REGEX.containsMatchIn(line) -> Unit // ignored, untracked
            line.startsWith("# Types:") -> {
                val parts = line.removePrefix("# Types:").trim().split("/").map { it.trim().lowercase() }
                val t1 = parts.getOrNull(0)?.let { PokemonType.fromApiName(it) }
                if (t1 != null) {
                    val t2 = parts.getOrNull(1)?.let { PokemonType.fromApiName(it) }
                    overrideTypes = t1 to t2
                }
            }
            IGNORED_DETAIL_PREFIXES.any { lower.startsWith(it) } -> Unit // ignored, untracked
            else -> Unit // unrecognized line: ignored, never overwrites the species
        }
    }

    val resolved = resolveSpecies(speciesName)
    val types = overrideTypes ?: resolved?.types ?: (PokemonType.NORMAL to null)

    val member = TeamMember(
        id = UUID.randomUUID().toString(),
        pokedexId = resolved?.id,
        speciesName = speciesName,
        types = types,
        ability = ability,
        item = item,
        moves = moves.toList(),
        isCustomSaved = false,
    )
    return ImportedMember(
        member = member,
        unknownMoveNames = unknown,
        speciesKnown = resolved != null,
        speciesName = speciesName,
    )
}

fun parseShowdownTeam(
    text: String,
    resolveMove: (String) -> MoveEntry?,
    resolveSpecies: (String) -> PokemonEntry?,
): List<ImportedMember> =
    text.split(Regex("\n\\s*\n"))
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .map { parseShowdownBlock(it, resolveMove, resolveSpecies) }

/** A block whose species couldn't be resolved against the catalogue. */
data class ImportError(val speciesName: String)

data class ImportResult(val members: List<ImportedMember>, val errors: List<ImportError>)

/**
 * Higher-level import that drops blocks whose species cannot be resolved and surfaces them as
 * [ImportResult.errors]. The caller should show an error and leave the team slots untouched for
 * the dropped entries.
 */
fun importShowdownTeam(
    text: String,
    resolveMove: (String) -> MoveEntry?,
    resolveSpecies: (String) -> PokemonEntry?,
): ImportResult {
    val blocks = parseShowdownTeam(text, resolveMove, resolveSpecies)
    val members = mutableListOf<ImportedMember>()
    val errors = mutableListOf<ImportError>()
    for (b in blocks) {
        if (b.speciesKnown) members += b else errors += ImportError(b.speciesName)
    }
    return ImportResult(members, errors)
}
