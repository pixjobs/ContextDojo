export const TRANSLATIONS = {
  en: {
    appTitle: "ContextDojo",
    save: "Save",
    clear: "Clear",
    
    // Accordion Headers
    contextTree: "Context Tree",
    transcriptTitle: "English Transcript",
    transcriptSubtitle: "Auto-Translated",
    
    // MindMap
    legendDiscussed: "Discussed",
    legendRecommendation: "Recommendation",
    activeTopic: "Active Topic",
    suggested: "Suggested",
    tryAsking: "Try asking",
    canWeTalkAbout: "Can we talk about",
    emptyGraph: "Knowledge Galaxy",
    emptyGraphSub: "Start chatting to map your conversation.",
    
    // Chat Interface
    you: "You",
    dojo: "Dojo",
    listening: "Listening...",
    thinking: "Thinking...",
    sayHello: "Say hello to start practicing.",
    typePlaceholder: "Type a message...",
    
    // Voice Widget
    voiceMode: "Voice Mode",
    agentSpeaking: "Agent Speaking...",
    speakNaturally: "Speak naturally",
    tapToConnect: "Tap to connect",
    configAgent: "Config Agent ID",
    done: "Done",
    
    // Transcript
    waitingForConv: "Waiting for conversation...",
    userRole: "User",
    dojoRole: "Dojo",
  },
  zh: {
    appTitle: "语境道场",
    save: "保存记录",
    clear: "重置",
    
    // Accordion Headers
    contextTree: "思维导图",
    transcriptTitle: "英文翻译",
    transcriptSubtitle: "自动翻译",
    
    // MindMap
    legendDiscussed: "已讨论",
    legendRecommendation: "推荐话题",
    activeTopic: "当前话题",
    suggested: "建议",
    tryAsking: "试着问",
    canWeTalkAbout: "我们可以聊聊",
    emptyGraph: "知识星系",
    emptyGraphSub: "开始对话以绘制您的思维地图。",
    
    // Chat Interface
    you: "你",
    dojo: "道场",
    listening: "正在听...",
    thinking: "思考中...",
    sayHello: "打个招呼开始练习吧。",
    typePlaceholder: "输入消息...",
    
    // Voice Widget
    voiceMode: "语音模式",
    agentSpeaking: "Agent 正在说话...",
    speakNaturally: "请自然交谈",
    tapToConnect: "点击连接",
    configAgent: "配置 Agent ID",
    done: "完成",
    
    // Transcript
    waitingForConv: "等待对话...",
    userRole: "用户",
    dojoRole: "道场",
  },
  de: {
    appTitle: "ContextDojo",
    save: "Speichern",
    clear: "Reset",
    
    // Accordion Headers
    contextTree: "Kontext-Baum",
    transcriptTitle: "Englisches Transkript",
    transcriptSubtitle: "Automatisch übersetzt",
    
    // MindMap
    legendDiscussed: "Diskutiert",
    legendRecommendation: "Empfehlung",
    activeTopic: "Aktives Thema",
    suggested: "Vorschlag",
    tryAsking: "Versuche zu fragen",
    canWeTalkAbout: "Können wir über ... sprechen",
    emptyGraph: "Wissensgalaxie",
    emptyGraphSub: "Beginne ein Gespräch, um deine Gedanken zu kartieren.",
    
    // Chat Interface
    you: "Du",
    dojo: "Dojo",
    listening: "Zuhören...",
    thinking: "Nachdenken...",
    sayHello: "Sag Hallo, um zu üben.",
    typePlaceholder: "Nachricht eingeben...",
    
    // Voice Widget
    voiceMode: "Sprachmodus",
    agentSpeaking: "Agent spricht...",
    speakNaturally: "Sprich ganz natürlich",
    tapToConnect: "Tippen zum Verbinden",
    configAgent: "Agent ID konfigurieren",
    done: "Fertig",
    
    // Transcript
    waitingForConv: "Warte auf Gespräch...",
    userRole: "Nutzer",
    dojoRole: "Dojo",
  }
};

export type Language = 'en' | 'zh' | 'de';
export type LabelSet = typeof TRANSLATIONS.en;