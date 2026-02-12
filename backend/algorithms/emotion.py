"""
帖子情感分析和代理状态情感分析。

使用各种方法从文本内容中提供情感评分。
"""
import re
import random
from typing import Optional
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class EmotionScore:
    """情感评分结果。"""
    valence: float  # -1（消极）到 1（积极）
    arousal: float  # 0（平静）到 1（兴奋）
    dominance: float  # 0（顺从）到 1（支配）
    confidence: float  # 0 到 1

    def to_dict(self) -> dict:
        return {
            "valence": self.valence,
            "arousal": self.arousal,
            "dominance": self.dominance,
            "confidence": self.confidence,
        }


# 情感词典（简化版，可替换为标准词典）
POSITIVE_WORDS = {
    # 强积极
    "amazing", "awesome", "excellent", "fantastic", "great", "love", "wonderful",
    "brilliant", "perfect", "beautiful", "happy", "joy", "excited", "delighted",
    "thrilled", "ecstatic", "pleased", "glad", "grateful", "blessed", "fortunate",
    # Medium positive
    "good", "nice", "like", "enjoy", "pleasant", "satisfied", "content",
    "pleased", "agree", "support", "approve", "recommend", "helpful", "useful",
    "interesting", "impressive", "cool", "fun", "better", "best", "hope",
    # Weak positive
    "fine", "okay", "alright", "decent", "acceptable", "maybe", "possibly",
}

NEGATIVE_WORDS = {
    # 强消极
    "terrible", "horrible", "awful", "hate", "disgusting", "dreadful", "worst",
    "abysmal", "appalling", "atrocious", "dismal", "frightening", "horrific",
    "outraged", "furious", "disgusted", "devastated", "miserable", "suffering",
    # Medium negative
    "bad", "poor", "dislike", "unpleasant", "annoying", "frustrating", "disappointed",
    "sad", "angry", "upset", "worried", "concerned", "afraid", "scared", "fear",
    "fail", "failure", "problem", "issue", "wrong", "reject", "oppose", "against",
    # Weak negative
    "not good", "not great", "unsure", "doubt", "question", "skeptical", "hesitant",
}

INTENSIFIERS = {
    "very": 1.5,
    "really": 1.4,
    "extremely": 1.8,
    "absolutely": 1.9,
    "totally": 1.6,
    "completely": 1.7,
    "utterly": 1.8,
    "quite": 1.3,
    "rather": 1.2,
    "somewhat": 1.1,
    "slightly": 1.05,
    "barely": 0.5,
    "hardly": 0.5,
    "a bit": 0.7,
    "kind of": 0.8,
    "sort of": 0.8,
}

NEGATORS = {
    "not", "no", "never", "none", "nothing", "nobody", "nowhere",
    "neither", "nor", "n't",  # "don't", "can't", etc.
}

ANGER_WORDS = {
    "angry", "furious", "rage", "outraged", "mad", "irritated", "annoyed",
    "frustrated", "livid", "irate", "hostile", "aggressive", "violent",
}

FEAR_WORDS = {
    "afraid", "scared", "fear", "terrified", "frightened", "anxious", "worried",
    "concerned", "nervous", "panic", "dread", "horrified", "petrified",
}

JOY_WORDS = {
    "happy", "joy", "excited", "thrilled", "delighted", "ecstatic", "elated",
    "cheerful", "glad", "pleased", "satisfied", "content", "celebrate",
}

SADNESS_WORDS = {
    "sad", "unhappy", "depressed", "miserable", "down", "blue", "gloomy",
    "heartbroken", "devastated", "disappointed", "let down", "crying",
}

SURPRISE_WORDS = {
    "surprised", "shocked", "amazed", "astonished", "stunned", "startled",
    "unexpected", "sudden", "wow", "whoa",
}

DISGUST_WORDS = {
    "disgusted", "gross", "revolting", "repulsive", "sick", "nauseating",
    "appalling", "horrible", "awful",
}


class LexiconEmotionAnalyzer:
    """
    使用词汇词典的情感分析器。

    基于词汇出现的简单但快速的情感分类。
    """

    def __init__(self):
        """初始化分析器。"""
        self.positive_words = POSITIVE_WORDS
        self.negative_words = NEGATIVE_WORDS
        self.intensifiers = INTENSIFIERS
        self.negators = NEGATORS
        self.emotion_words = {
            "anger": ANGER_WORDS,
            "fear": FEAR_WORDS,
            "joy": JOY_WORDS,
            "sadness": SADNESS_WORDS,
            "surprise": SURPRISE_WORDS,
            "disgust": DISGUST_WORDS,
        }

    def _tokenize(self, text: str) -> list[str]:
        """简单分词。"""
        # 转换为小写
        text = text.lower()
        # 将 URL、提及、标签替换为占位符
        text = re.sub(r'http\S+', ' ', text)
        text = re.sub(r'@\w+', ' ', text)
        text = re.sub(r'#\w+', ' ', text)
        # 删除标点符号但保留缩略词中的撇号
        text = re.sub(r'[^\w\s\']', ' ', text)
        # 按空白分割
        tokens = text.split()
        return tokens

    def _detect_negation(self, tokens: list[str], index: int) -> bool:
        """通过查看前面的词来检查词是否被否定。"""
        # 检查前 3 个词中的否定词
        start = max(0, index - 3)
        for i in range(start, index):
            if tokens[i] in self.negators or tokens[i].endswith("n't"):
                return True
        return False

    def _get_intensifier(self, tokens: list[str], index: int) -> float:
        """从前面的词获取增强词强度。"""
        # 检查前 2 个词中的增强词
        start = max(0, index - 2)
        for i in range(start, index):
            if tokens[i] in self.intensifiers:
                return self.intensifiers[tokens[i]]
        return 1.0

    def analyze(self, text: str) -> EmotionScore:
        """
        分析文本中的情感。

        参数：
            text: 要分析的文本

        返回：
            包含 valence、arousal、dominance 的 EmotionScore
        """
        if not text:
            return EmotionScore(valence=0.0, arousal=0.0, dominance=0.5, confidence=0.0)

        tokens = self._tokenize(text)

        positive_score = 0.0
        negative_score = 0.0
        emotion_counts = defaultdict(int)

        for i, token in enumerate(tokens):
            is_negated = self._detect_negation(tokens, i)
            intensifier = self._get_intensifier(tokens, i)

            # 检查情感
            if token in self.positive_words:
                score = 1.0 * intensifier
                if is_negated:
                    negative_score += score
                else:
                    positive_score += score

            if token in self.negative_words:
                score = 1.0 * intensifier
                if is_negated:
                    positive_score += score
                else:
                    negative_score += score

            # 检查特定情感
            for emotion, words in self.emotion_words.items():
                if token in words:
                    emotion_counts[emotion] += 1 * intensifier

        # 归一化分数
        total_words = len(tokens)
        if total_words > 0:
            positive_score /= total_words
            negative_score /= total_words

        # 计算 valence（-1 到 1）
        valence = positive_score - negative_score
        valence = max(-1.0, min(1.0, valence * 5))  # 放大

        # 根据情感强度计算 arousal
        arousal = sum(emotion_counts.values()) / max(total_words, 1) * 2
        arousal = min(1.0, arousal)

        # 计算 dominance（积极情感 -> 更高的支配度）
        dominance = 0.5 + (valence * 0.3)
        dominance = max(0.0, min(1.0, dominance))

        # 根据找到的情感词数量计算置信度
        total_emotion_words = sum(emotion_counts.values()) + positive_score * 5 + negative_score * 5
        confidence = min(1.0, total_emotion_words / max(total_words * 0.1, 1))

        return EmotionScore(
            valence=valence,
            arousal=arousal,
            dominance=dominance,
            confidence=confidence,
        )

    def get_emotion_category(self, text: str) -> str:
        """
        获取文本的主要情感类别。

        返回：'angry'、'fearful'、'happy'、'sad'、'surprised'、'calm' 之一
        """
        score = self.analyze(text)

        # 确定主要情感
        if score.valence < -0.3 and score.arousal > 0.5:
            return "angry"
        elif score.valence < -0.3:
            return "sad"
        elif score.valence > 0.3 and score.arousal > 0.6:
            return "happy"
        elif score.valence > 0.2:
            return "calm"
        elif score.arousal > 0.7:
            return "surprised"
        else:
            return "calm"


class RuleBasedEmotionAnalyzer:
    """
    基于规则的情感分析器，具有更复杂的模式。
    """

    def __init__(self):
        """初始化分析器。"""
        self.lexicon_analyzer = LexiconEmotionAnalyzer()

        # Emotion patterns (regex)
        self.patterns = {
            "excitement": [
                r"\b(!+ )",  # Exclamation marks
                r"\b(?!.*not)(so|very|really|totally|absolutely) (excited|happy|great)\b",
                r"\b(can't wait|look forward to)\b",
            ],
            "anger": [
                r"\b(!{2,})\b",  # Multiple exclamation marks
                r"\b(wtf|omg|wth)\b",
                r"\b(?!.*not)(so|very|really) (angry|furious|mad|pissed)\b",
            ],
            "question": [
                r"\?$",  # Ends with question mark
                r"\b(why|how|what|when|where|who)\b",
            ],
            "agreement": [
                r"\b(^yes|^yeah|^yup|^totally|^absolutely|^exactly)\b",
                r"\b(i agree|i agree with)\b",
            ],
            "disagreement": [
                r"\b(^no|^nope|^wrong|^incorrect)\b",
                r"\b(i disagree|i disagree with)\b",
            ],
        }

    def analyze(self, text: str) -> EmotionScore:
        """
        使用规则和词典分析情感。
        """
        # Start with lexicon analysis
        score = self.lexicon_analyzer.analyze(text)

        # Check for additional patterns
        text_lower = text.lower()

        # Excitement boosters
        if "!!" in text or "!!!".lower() in text_lower:
            score.arousal = min(1.0, score.arousal + 0.2)

        # Question detection (increases arousal slightly)
        if "?" in text:
            score.arousal = min(1.0, score.arousal + 0.05)

        # All caps (high arousal)
        if any(word.isupper() and len(word) > 2 for word in text.split()):
            score.arousal = min(1.0, score.arousal + 0.15)
            score.valence *= 1.2  # Amplify sentiment

        # Hashtags (often indicate passion)
        if "#" in text:
            score.arousal = min(1.0, score.arousal + 0.1)

        # Emojis (simple detection)
        emoji_positive = ["😊", "😂", "🤣", "❤️", "👍", "🔥", "✨", "🎉", "💯"]
        emoji_negative = ["😢", "😭", "😡", "👎", "😤", "😠"]

        for emoji in emoji_positive:
            if emoji in text:
                score.valence = min(1.0, score.valence + 0.2)
                score.arousal = min(1.0, score.arousal + 0.1)

        for emoji in emoji_negative:
            if emoji in text:
                score.valence = max(-1.0, score.valence - 0.2)
                score.arousal = min(1.0, score.arousal + 0.1)

        return score


class TransformerEmotionAnalyzer:
    """
    使用 transformer 模型的情感分析器（可选，较慢但更准确）。

    需要：pip install transformers torch
    """

    def __init__(self, model_name: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"):
        """
        初始化 transformer 分析器。

        参数：
            model_name：用于情感分析的 HuggingFace 模型名称
        """
        self.model_name = model_name
        self._model = None
        self._tokenizer = None
        self._loaded = False

    def _load_model(self):
        """延迟加载模型。"""
        if self._loaded:
            return

        try:
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            import torch

            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            self._loaded = True
        except ImportError:
            # 如果 transformers 不可用，回退到基于规则的分析器
            self._loaded = False

    def analyze(self, text: str) -> EmotionScore:
        """
        使用 transformer 模型分析情感。
        """
        self._load_model()

        if not self._loaded or not text:
            # 回退到基于规则的分析器
            analyzer = RuleBasedEmotionAnalyzer()
            return analyzer.analyze(text)

        try:
            import torch

            # Tokenize and predict
            inputs = self._tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
            with torch.no_grad():
                outputs = self._model(**inputs)
                predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)

            # Model-specific mapping (twitter-roberta-base-sentiment-latest)
            # Labels: negative, neutral, positive
            scores = predictions[0].tolist()

            # Convert to valence
            negative, neutral, positive = scores
            valence = positive - negative

            # Approximate arousal and dominance
            # (transformer sentiment models don't typically output these)
            arousal = 1.0 - neutral  # Less neutral = more arousal
            dominance = 0.5 + (valence * 0.3)

            return EmotionScore(
                valence=valence,
                arousal=arousal,
                dominance=dominance,
                confidence=max(scores),  # Confidence is the max probability
            )

        except Exception as e:
            # 回退到基于规则的分析器
            analyzer = RuleBasedEmotionAnalyzer()
            return analyzer.analyze(text)


# Default analyzer (can be changed)
_default_analyzer = None


def get_default_analyzer() -> RuleBasedEmotionAnalyzer:
    """获取默认情感分析器。"""
    global _default_analyzer
    if _default_analyzer is None:
        _default_analyzer = RuleBasedEmotionAnalyzer()
    return _default_analyzer


def analyze_emotion(text: str, method: str = "rule") -> EmotionScore:
    """
    分析文本中的情感。

    参数：
        text: 要分析的文本
        method: 分析方法（'lexicon'、'rule'、'transformer'）

    返回：
        包含 valence、arousal、dominance 的 EmotionScore
    """
    if method == "lexicon":
        analyzer = LexiconEmotionAnalyzer()
    elif method == "rule":
        analyzer = RuleBasedEmotionAnalyzer()
    elif method == "transformer":
        analyzer = TransformerEmotionAnalyzer()
    else:
        analyzer = get_default_analyzer()

    return analyzer.analyze(text)


def get_emotion_value(text: str) -> float:
    """
    从文本获取单个情感值（-1 到 1）。

    这是前端使用的主要函数。

    参数：
        text: 要分析的文本

    返回：
        从 -1（最消极）到 1（最积极）的浮点数
    """
    score = analyze_emotion(text)
    return score.valence


def get_emotion_from_content(content: str, fallback: float = 0.0) -> float:
    """
    从内容获取情感值，支持后备值。

    参数：
        content: 内容文本
        fallback: 如果分析失败时的后备值

    返回：
        情感值 -1 到 1
    """
    if not content or not content.strip():
        return fallback

    try:
        return get_emotion_value(content)
    except Exception:
        return fallback


# Sentiment label mapping
def sentiment_from_valence(valence: float) -> str:
    """将 valence 转换为情感标签。"""
    if valence > 0.5:
        return "happy"
    elif valence > 0.2:
        return "calm"
    elif valence < -0.5:
        return "angry"
    elif valence < -0.2:
        return "sad"
    else:
        return "calm"


# Mood change simulation
def simulate_mood_change(
    current_mood: float,
    external_stimulus: float,
    openness: float = 0.5,
    neuroticism: float = 0.5,
) -> float:
    """
    基于外部刺激和人格模拟情绪变化。

    参数：
        current_mood: 当前情绪值（-1 到 1）
        external_stimulus: 外部刺激（-1 到 1）
        openness: 开放性特质（0 到 1）- 影响响应性
        neuroticism: 神经质特质（0 到 1）- 影响负面偏向

    返回：
        新情绪值
    """
    # 神经质增加对消极刺激的敏感性
    if external_stimulus < 0:
        stimulus_strength = abs(external_stimulus) * (1 + neuroticism * 0.5)
        change = -stimulus_strength
    else:
        change = external_stimulus

    # 开放性影响情绪变化程度
    change *= (0.3 + openness * 0.4)

    # 应用变化并衰减（情绪趋向中性）
    new_mood = current_mood * 0.9 + change * 0.1

    # 限制在有效范围内
    return max(-1.0, min(1.0, new_mood))
