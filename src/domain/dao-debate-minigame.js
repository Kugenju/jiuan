(() => {
  window.GAME_RUNTIME = window.GAME_RUNTIME || {};

  function buildDaoDebateCardPool(taskDef, taskInstance) {
    const allCards = window.GAME_DATA.DAO_DEBATE_CARDS || {};
    const hiddenFlags = new Set(taskInstance?.unlockFlags || []);

    return Object.values(allCards).filter((card) => {
      if (!card.hidden) {
        return true;
      }

      return hiddenFlags.has(card.unlockFlag);
    });
  }

  function drawRandomCards(pool, size, rng) {
    const source = pool.map((card) => ({ ...card }));
    const hand = [];

    while (source.length && hand.length < size) {
      const random = typeof rng === "function" ? rng() : Math.random();
      const index = Math.floor(random * source.length);
      hand.push(source.splice(index, 1)[0]);
    }

    return hand;
  }

  function drawDaoDebateHand(taskDef, taskInstance, rng) {
    const cardPool = buildDaoDebateCardPool(taskDef, taskInstance);
    const handSize = Math.max(1, Number(taskDef?.rounds?.handSize || 5));
    const hiddenCardLimit = Math.max(0, Number(taskDef?.rounds?.hiddenCardLimit || 0));

    const unlockedHiddenCards = cardPool.filter((card) => card.hidden);
    const visibleCards = cardPool.filter((card) => !card.hidden);

    const hiddenHand = drawRandomCards(unlockedHiddenCards, Math.min(hiddenCardLimit, handSize), rng);
    const remainingSize = Math.max(0, handSize - hiddenHand.length);
    const visibleHand = drawRandomCards(visibleCards, remainingSize, rng);

    return hiddenHand.concat(visibleHand);
  }

  function getOpeningPrompt(topicId) {
    const topic = window.GAME_DATA.DAO_DEBATE_TOPICS?.[topicId];
    return {
      title: topic?.title || "",
      body: topic?.openingPrompt || "",
      followupType: "opening",
    };
  }

  function getFollowupTypeForTag(tag) {
    const followupTypeByTag = {
      principle: "press_principle",
      utility: "press_utility",
      authority: "press_authority",
      experience: "press_principle",
      counterexample: "press_principle",
      evasion: "press_evasion",
    };

    return followupTypeByTag[tag] || "press_principle";
  }

  function scorePromptResponse(promptType, tag) {
    const scoringMatrix = {
      opening: {
        principle: "strong",
        utility: "strong",
        authority: "ok",
        experience: "ok",
        counterexample: "ok",
        evasion: "weak",
      },
      press_principle: {
        principle: "strong",
        counterexample: "strong",
        experience: "ok",
        authority: "weak",
        utility: "ok",
        evasion: "weak",
      },
      press_utility: {
        experience: "strong",
        utility: "ok",
        principle: "ok",
        authority: "weak",
        counterexample: "ok",
        evasion: "weak",
      },
      press_authority: {
        experience: "strong",
        counterexample: "strong",
        principle: "ok",
        authority: "weak",
        utility: "ok",
        evasion: "weak",
      },
      press_evasion: {
        principle: "strong",
        utility: "ok",
        experience: "ok",
        counterexample: "ok",
        authority: "weak",
        evasion: "weak",
      },
    };

    return scoringMatrix[promptType]?.[tag] || "weak";
  }

  function createDaoDebateSessionState(taskDef, taskInstance, rng) {
    const topicId = taskInstance?.topicId || taskDef?.topicPool?.[0] || "topic_1";

    return {
      topicId,
      roundIndex: 1,
      maxRounds: Math.max(1, Number(taskDef?.rounds?.maxRounds || 3)),
      conviction: 0,
      exposure: 0,
      hand: drawDaoDebateHand(taskDef, taskInstance, rng),
      currentPrompt: getOpeningPrompt(topicId),
      history: [],
      result: null,
    };
  }

  function playDaoDebateCard(session, cardId, taskDef) {
    if (session?.result || session?.roundIndex > session?.maxRounds) {
      return session;
    }

    const card = (session.hand || []).find((entry) => entry.id === cardId);
    if (!card) {
      return session;
    }

    const promptType = session.currentPrompt?.followupType || "opening";
    const scoreType = scorePromptResponse(promptType, card.tag);
    const convictionDelta = scoreType === "strong" ? 2 : scoreType === "ok" ? 1 : 0;
    const exposureDelta = scoreType === "weak" ? 1 : 0;

    const nextSession = {
      ...session,
      hand: (session.hand || []).filter((entry) => entry.id !== cardId),
      conviction: session.conviction + convictionDelta,
      exposure: session.exposure + exposureDelta,
      history: (session.history || []).concat([
        {
          roundIndex: session.roundIndex,
          cardId: card.id,
          tag: card.tag,
          scoreType,
          promptType,
        },
      ]),
      roundIndex: session.roundIndex + 1,
    };

    if (session.roundIndex >= session.maxRounds) {
      nextSession.result = settleDaoDebateSession(nextSession, taskDef);
      return nextSession;
    }

    const followupType = getFollowupTypeForTag(card.tag);
    nextSession.currentPrompt = {
      followupType,
      body: window.GAME_DATA.DAO_DEBATE_FOLLOWUPS?.[followupType]?.prompt || "",
    };

    return nextSession;
  }

  function settleDaoDebateSession(session, taskDef) {
    const rules = taskDef?.successRules || {};
    const convictionTarget = Number(rules.convictionTarget || 5);
    const maxExposure = Number(rules.maxExposure || 1);
    const fallbackConvictionTarget = Number(rules.fallbackConvictionTarget || 4);
    const fallbackExposure = Number(rules.fallbackExposure || 0);

    const directPass = session.conviction >= convictionTarget && session.exposure <= maxExposure;
    const fallbackPass =
      session.conviction >= fallbackConvictionTarget && session.exposure === fallbackExposure;

    const status = directPass || fallbackPass ? "success" : "failure";
    return {
      status,
      conviction: session.conviction,
      exposure: session.exposure,
      scoreLabel: status === "success" ? "pass" : "fail",
    };
  }

  Object.assign(window.GAME_RUNTIME, {
    createDaoDebateSessionState,
    playDaoDebateCard,
    settleDaoDebateSession,
  });
})();
