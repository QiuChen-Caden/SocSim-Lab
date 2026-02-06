"""
Emotion analysis for posts and agent states.

Provides emotion scoring from text content using various methods.
"""
import re
import random
from typing import Optional
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class EmotionScore:
    """Emotion score result."""
    valence: float  # -1 (negative) to 1 (positive)
    arousal: float  # 0 (calm) to 1 (excited)
    dominance: float  # 0 (submissive) to 1 (dominant)
    confidence: float  # 0 to 1

    def to_dict(self) -> dict:
        return {
            "valence": self.valence,
            "arousal": self.arousal,
            "dominance": self.dominance,
            "confidence": self.confidence,
        }


# Emotion lexicons (simplified, could be replaced with proper lexicons)
POSITIVE_WORDS = {
    # Strong positive
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
    # Strong negative
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
    Emotion analyzer using word lexicons.

    Simple but fast emotion classification based on word presence.
    """

    def __init__(self):
        """Initialize the analyzer."""
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
        """Simple tokenization."""
        # Convert to lowercase
        text = text.lower()
        # Replace URLs, mentions, hashtags with placeholders
        text = re.sub(r'http\S+', ' ', text)
        text = re.sub(r'@\w+', ' ', text)
        text = re.sub(r'#\w+', ' ', text)
        # Remove punctuation but keep apostrophes for contractions
        text = re.sub(r'[^\w\s\']', ' ', text)
        # Split on whitespace
        tokens = text.split()
        return tokens

    def _detect_negation(self, tokens: list[str], index: int) -> bool:
        """Check if a word is negated by looking at previous words."""
        # Check previous 3 words for negators
        start = max(0, index - 3)
        for i in range(start, index):
            if tokens[i] in self.negators or tokens[i].endswith("n't"):
                return True
        return False

    def _get_intensifier(self, tokens: list[str], index: int) -> float:
        """Get intensifier strength from previous words."""
        # Check previous 2 words for intensifiers
        start = max(0, index - 2)
        for i in range(start, index):
            if tokens[i] in self.intensifiers:
                return self.intensifiers[tokens[i]]
        return 1.0

    def analyze(self, text: str) -> EmotionScore:
        """
        Analyze emotion in text.

        Args:
            text: Text to analyze

        Returns:
            EmotionScore with valence, arousal, dominance
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

            # Check sentiment
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

            # Check specific emotions
            for emotion, words in self.emotion_words.items():
                if token in words:
                    emotion_counts[emotion] += 1 * intensifier

        # Normalize scores
        total_words = len(tokens)
        if total_words > 0:
            positive_score /= total_words
            negative_score /= total_words

        # Calculate valence (-1 to 1)
        valence = positive_score - negative_score
        valence = max(-1.0, min(1.0, valence * 5))  # Scale up

        # Calculate arousal based on emotion intensity
        arousal = sum(emotion_counts.values()) / max(total_words, 1) * 2
        arousal = min(1.0, arousal)

        # Calculate dominance (positive emotions -> higher dominance)
        dominance = 0.5 + (valence * 0.3)
        dominance = max(0.0, min(1.0, dominance))

        # Confidence based on amount of emotion words found
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
        Get the primary emotion category for text.

        Returns: one of 'angry', 'fearful', 'happy', 'sad', 'surprised', 'calm'
        """
        score = self.analyze(text)

        # Determine primary emotion
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
    Rule-based emotion analyzer with more sophisticated patterns.
    """

    def __init__(self):
        """Initialize the analyzer."""
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
        Analyze emotion using rules and lexicon.
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
    Emotion analyzer using transformer models (optional, slower but more accurate).

    Requires: pip install transformers torch
    """

    def __init__(self, model_name: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"):
        """
        Initialize the transformer analyzer.

        Args:
            model_name: HuggingFace model name for sentiment analysis
        """
        self.model_name = model_name
        self._model = None
        self._tokenizer = None
        self._loaded = False

    def _load_model(self):
        """Lazy load the model."""
        if self._loaded:
            return

        try:
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            import torch

            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            self._loaded = True
        except ImportError:
            # Fall back to rule-based if transformers not available
            self._loaded = False

    def analyze(self, text: str) -> EmotionScore:
        """
        Analyze emotion using transformer model.
        """
        self._load_model()

        if not self._loaded or not text:
            # Fall back to rule-based
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
            # Fall back on error
            analyzer = RuleBasedEmotionAnalyzer()
            return analyzer.analyze(text)


# Default analyzer (can be changed)
_default_analyzer = None


def get_default_analyzer() -> RuleBasedEmotionAnalyzer:
    """Get the default emotion analyzer."""
    global _default_analyzer
    if _default_analyzer is None:
        _default_analyzer = RuleBasedEmotionAnalyzer()
    return _default_analyzer


def analyze_emotion(text: str, method: str = "rule") -> EmotionScore:
    """
    Analyze emotion in text.

    Args:
        text: Text to analyze
        method: Analysis method ('lexicon', 'rule', 'transformer')

    Returns:
        EmotionScore with valence, arousal, dominance
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
    Get a single emotion value from text (-1 to 1).

    This is the main function used by the frontend.

    Args:
        text: Text to analyze

    Returns:
        Float from -1 (most negative) to 1 (most positive)
    """
    score = analyze_emotion(text)
    return score.valence


def get_emotion_from_content(content: str, fallback: float = 0.0) -> float:
    """
    Get emotion value from content, with fallback.

    Args:
        content: Content text
        fallback: Fallback value if analysis fails

    Returns:
        Emotion value -1 to 1
    """
    if not content or not content.strip():
        return fallback

    try:
        return get_emotion_value(content)
    except Exception:
        return fallback


# Sentiment label mapping
def sentiment_from_valence(valence: float) -> str:
    """Convert valence to sentiment label."""
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
    Simulate mood change based on external stimulus and personality.

    Args:
        current_mood: Current mood value (-1 to 1)
        external_stimulus: External stimulus (-1 to 1)
        openness: Openness trait (0 to 1) - affects responsiveness
        neuroticism: Neuroticism trait (0 to 1) - affects negative bias

    Returns:
        New mood value
    """
    # Neuroticism increases sensitivity to negative stimuli
    if external_stimulus < 0:
        stimulus_strength = abs(external_stimulus) * (1 + neuroticism * 0.5)
        change = -stimulus_strength
    else:
        change = external_stimulus

    # Openness affects how much mood changes
    change *= (0.3 + openness * 0.4)

    # Apply change with decay (mood tends toward neutral)
    new_mood = current_mood * 0.9 + change * 0.1

    # Clamp to valid range
    return max(-1.0, min(1.0, new_mood))
