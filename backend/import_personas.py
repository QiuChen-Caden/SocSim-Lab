"""
Import Twitter personas JSON file into the backend database.

This script reads the twitter_personas_YYYYMMDD_HHMMSS.json file
and imports all personas into the OASIS database.
"""
import json
import sys
import os.path as osp
from typing import Any, Dict

# Add backend to path
sys.path.insert(0, osp.dirname(__file__))

from models.types import (
    AgentProfile,
    Identity,
    Psychometrics,
    BigFive,
    MoralFoundations,
    SocialStatus,
    BehaviorProfile,
    CognitiveState,
    CoreAffect,
    IssueStance,
    AgeBand,
    Gender,
    InfluenceTier,
    EconomicBand,
    DiurnalPattern,
    Sentiment,
)
from models.database import (
    init_db,
    save_agent_profile,
    get_db_path,
)
from algorithms.emotion import get_emotion_from_content


def load_personas_file(filepath: str = "../twitter_personas_20260123_222506.json") -> Dict[str, Any]:
    """Load the personas JSON file."""
    full_path = osp.join(osp.dirname(__file__), filepath)
    with open(full_path, "r", encoding="utf-8") as f:
        return json.load(f)


def convert_persona_to_agent(
    user_key: str,
    persona_data: Dict[str, Any],
    agent_id: int,
) -> AgentProfile:
    """
    Convert a persona from the JSON to an AgentProfile.

    Args:
        user_key: The user key from the JSON (e.g., "user_988804598394707968")
        persona_data: The persona data dictionary
        agent_id: The numeric agent ID to assign

    Returns:
        AgentProfile instance
    """
    persona = persona_data.get("persona", {})
    metadata = persona_data.get("metadata", {})

    # Identity
    identity_data = persona.get("identity", {})
    location = identity_data.get("location", {})

    # Clean username - remove @ prefix if present
    username = identity_data.get("username", "")
    if username.startswith("@"):
        username = username[1:]

    identity = Identity(
        username=username,
        age_band=AgeBand(identity_data.get("age_band", "unknown")),
        gender=Gender(identity_data.get("gender", "unknown")),
        country=location.get("country", ""),
        region_city=location.get("region_city", ""),
        profession=identity_data.get("profession", ""),
        domain_of_expertise=identity_data.get("domain_of_expertise", []),
    )

    # Psychometrics
    psychometrics_data = persona.get("psychometrics", {})
    personality_data = psychometrics_data.get("personality", {})
    values_data = psychometrics_data.get("values", {})

    big_five_data = personality_data.get("big_five", {})
    moral_data = values_data.get("moral_foundations", {})

    psychometrics = Psychometrics(
        big_five=BigFive(
            O=big_five_data.get("O", 0.5),
            C=big_five_data.get("C", 0.5),
            E=big_five_data.get("E", 0.5),
            A=big_five_data.get("A", 0.5),
            N=big_five_data.get("N", 0.5),
        ),
        moral_foundations=MoralFoundations(
            care=moral_data.get("care", 0.5),
            fairness=moral_data.get("fairness", 0.5),
            loyalty=moral_data.get("loyalty", 0.5),
            authority=moral_data.get("authority", 0.5),
            sanctity=moral_data.get("sanctity", 0.5),
        ),
    )

    # Social Status
    social_status_data = persona.get("social_status", {})
    social_capital_data = social_status_data.get("social_capital", {})

    social_status = SocialStatus(
        influence_tier=InfluenceTier(social_status_data.get("influence_tier", "ordinary_user")),
        economic_band=EconomicBand(social_status_data.get("economic_band", "medium")),
        network_size_proxy=int(social_capital_data.get("network_size_proxy", 2)),
    )

    # Behavior Profile
    behavior_data = persona.get("behavior_profile", {})
    posting_cadence_data = behavior_data.get("posting_cadence", {})
    rhetoric_data = behavior_data.get("rhetoric_style", {})

    diurnal_patterns = posting_cadence_data.get("diurnal_pattern", ["unknown"])
    diurnal_pattern = [
        DiurnalPattern(p) if p != "unknown" else DiurnalPattern.UNKNOWN
        for p in diurnal_patterns
    ]

    behavior_profile = BehaviorProfile(
        posts_per_day=posting_cadence_data.get("posts_per_day", 1.0),
        diurnal_pattern=diurnal_pattern,
        civility=rhetoric_data.get("civility", 0.5),
        evidence_citation=rhetoric_data.get("evidence_citation", 0.5),
    )

    # Cognitive State
    cognitive_data = persona.get("cognitive_state", {})
    core_affect_data = cognitive_data.get("core_affect", {})
    issue_stances_data = cognitive_data.get("issue_stances", [])

    cognitive_state = CognitiveState(
        core_affect=CoreAffect(
            sentiment=Sentiment(core_affect_data.get("sentiment", "calm")),
            arousal=core_affect_data.get("arousal", 0.5),
        ),
        issue_stances=[
            IssueStance(
                topic=stance.get("topic", ""),
                support=stance.get("support", 0.0),
                certainty=stance.get("certainty", 0.5),
            )
            for stance in issue_stances_data
        ],
    )

    # Determine group based on metadata or assign sequentially
    # Groups: Group A, Group B, Group C, Group D, Group E
    group_number = (agent_id - 1) % 5
    group_names = ["Group A", "Group B", "Group C", "Group D", "Group E"]
    group = group_names[group_number]

    # Name: use username or fallback
    name = username or f"Agent_{agent_id}"

    return AgentProfile(
        id=agent_id,
        name=name,
        group=group,
        identity=identity,
        psychometrics=psychometrics,
        social_status=social_status,
        behavior_profile=behavior_profile,
        cognitive_state=cognitive_state,
    )


def import_personas(
    filepath: str = "../twitter_personas_20260123_222506.json",
    clear_existing: bool = False,
) -> int:
    """
    Import personas from JSON file into the database.

    Args:
        filepath: Path to the personas JSON file
        clear_existing: Whether to clear existing agents first

    Returns:
        Number of agents imported
    """
    # Load the JSON file
    print(f"Loading personas from: {filepath}")
    data = load_personas_file(filepath)

    # Initialize database
    print("Initializing database...")
    init_db()
    print(f"Database: {get_db_path()}")

    # Get personas dictionary
    personas = data.get("personas", {})
    total_personas = len(personas)
    print(f"Found {total_personas} personas to import")

    # Optional: Clear existing agents
    if clear_existing:
        print("Warning: Clearing existing agents (not yet implemented)")

    # Import each persona
    imported_count = 0
    for agent_id, (user_key, persona_data) in enumerate(personas.items(), start=1):
        try:
            agent_profile = convert_persona_to_agent(user_key, persona_data, agent_id)
            save_agent_profile(agent_profile)
            imported_count += 1

            if imported_count % 10 == 0:
                print(f"  Imported {imported_count}/{total_personas} agents...")

        except Exception as e:
            print(f"  Error importing {user_key}: {e}")
            import traceback
            traceback.print_exc()

    print(f"Import complete! {imported_count}/{total_personas} agents imported.")
    return imported_count


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Import Twitter personas into OASIS database")
    parser.add_argument(
        "--file",
        "-f",
        default="../twitter_personas_20260123_222506.json",
        help="Path to the personas JSON file",
    )
    parser.add_argument(
        "--clear",
        "-c",
        action="store_true",
        help="Clear existing agents before import",
    )

    args = parser.parse_args()

    import_personas(args.file, args.clear)


if __name__ == "__main__":
    main()
