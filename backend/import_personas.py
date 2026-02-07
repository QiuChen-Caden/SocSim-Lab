"""
将 Twitter personas JSON 文件导入后端数据库。

此脚本读取 twitter_personas_YYYYMMDD_HHMMSS.json 文件
并将所有 personas 导入 OASIS 数据库。
"""
import json
import sys
import os.path as osp
from pathlib import Path
from typing import Any, Dict

# 将 backend 添加到路径
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


DEFAULT_PERSONAS_FILE = "twitter_personas_20260123_222506.json"


def _resolve_personas_path(filepath: str) -> Path:
    """跨常见仓库布局解析 personas 文件路径。"""
    base_dir = Path(__file__).resolve().parent
    candidate_paths: list[Path] = []

    raw = Path(filepath)
    if raw.is_absolute():
        candidate_paths.append(raw)
    else:
        # 优先使用从脚本目录开始的显式相对路径。
        candidate_paths.append(base_dir / raw)
        # 如果相对路径包含 ../ 之类的父级引用，也尝试在 backend 中使用基本名称。
        candidate_paths.append(base_dir / raw.name)
        # 尝试仓库根目录（backend 的父级）。
        candidate_paths.append(base_dir.parent / raw)
        candidate_paths.append(base_dir.parent / raw.name)
        # 最后，尝试 CWD 以防用户从其他位置运行。
        candidate_paths.append(Path.cwd() / raw)

    for candidate in candidate_paths:
        if candidate.exists():
            return candidate

    searched = "\n".join(str(p) for p in candidate_paths)
    raise FileNotFoundError(
        f"Personas file not found. Tried:\n{searched}"
    )


def load_personas_file(filepath: str = DEFAULT_PERSONAS_FILE) -> Dict[str, Any]:
    """加载 personas JSON 文件。"""
    full_path = _resolve_personas_path(filepath)
    with open(full_path, "r", encoding="utf-8") as f:
        return json.load(f)


def convert_persona_to_agent(
    user_key: str,
    persona_data: Dict[str, Any],
    agent_id: int,
) -> AgentProfile:
    """
    将 JSON 中的 persona 转换为 AgentProfile。

    参数：
        user_key: JSON 中的用户键（例如 "user_988804598394707968"）
        persona_data: persona 数据字典
        agent_id: 要分配的数字代理 ID

    返回：
        AgentProfile 实例
    """
    persona = persona_data.get("persona", {})
    metadata = persona_data.get("metadata", {})

    # 身份信息
    identity_data = persona.get("identity", {})
    location = identity_data.get("location", {})

    # 清理用户名 - 如果存在 @ 前缀则删除
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

    # 心理测量
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

    # 社会地位
    social_status_data = persona.get("social_status", {})
    social_capital_data = social_status_data.get("social_capital", {})

    social_status = SocialStatus(
        influence_tier=InfluenceTier(social_status_data.get("influence_tier", "ordinary_user")),
        economic_band=EconomicBand(social_status_data.get("economic_band", "medium")),
        network_size_proxy=int(social_capital_data.get("network_size_proxy", 2)),
    )

    # 行为画像
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

    # 认知状态
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

    # 根据元数据确定组或按顺序分配
    # 组别：Group A, Group B, Group C, Group D, Group E
    group_number = (agent_id - 1) % 5
    group_names = ["Group A", "Group B", "Group C", "Group D", "Group E"]
    group = group_names[group_number]

    # 名称：使用用户名或后备名称
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
    filepath: str = DEFAULT_PERSONAS_FILE,
    clear_existing: bool = False,
) -> int:
    """
    将 personas 从 JSON 文件导入数据库。

    参数：
        filepath: personas JSON 文件的路径
        clear_existing: 是否首先清除现有代理

    返回：
        导入的代理数量
    """
    # 加载 JSON 文件
    resolved_path = _resolve_personas_path(filepath)
    print(f"Loading personas from: {resolved_path}")
    data = load_personas_file(str(resolved_path))

    # 初始化数据库
    print("Initializing database...")
    init_db()
    print(f"Database: {get_db_path()}")

    # 获取 personas 字典
    personas = data.get("personas", {})
    total_personas = len(personas)
    print(f"Found {total_personas} personas to import")

    # 可选：清除现有代理
    if clear_existing:
        print("Warning: Clearing existing agents (not yet implemented)")

    # 导入每个 persona
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
    """主入口点。"""
    import argparse

    parser = argparse.ArgumentParser(description="Import Twitter personas into OASIS database")
    parser.add_argument(
        "--file",
        "-f",
        default=DEFAULT_PERSONAS_FILE,
        help="Path to the personas JSON file",  # personas JSON 文件的路径
    )
    parser.add_argument(
        "--clear",
        "-c",
        action="store_true",
        help="Clear existing agents before import",  # 在导入前清除现有代理
    )

    args = parser.parse_args()

    import_personas(args.file, args.clear)


if __name__ == "__main__":
    main()
