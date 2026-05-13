// IDIA Psychometric Test Bank — 1 Tutorial + 9 telemetry modules
export type TestId = "tut" | "seb" | "ass" | "snv" | "jrda" | "ocs" | "pcf" | "eq" | "gup" | "scs";
export type Pillar = "Training" | "Social Connectivity Index" | "Work Engagement Index" | "Prosocial Disposition Index";

export interface TestModule {
  id: TestId;
  pillar: Pillar;
  title: string;
  description: string;
  questions: string[];
}

export const REVERSE_SCORED_INDICES = [0, 2, 4, 6, 8, 9];

export const TEST_BANK: Record<TestId, TestModule> = {
  tut: {
    id: "tut",
    pillar: "Training",
    title: "How to IDIA",
    description: "A quick warm-up to learn the controls and see why this is fun.",
    questions: [
      "I understand that selecting '5' means I strongly agree with a statement.",
      "I am ready to help build a deterministic 'Verified Truth Economy'.",
      "I find it exciting that my character, not just my cash, determines my credit.",
    ],
  },
  seb: {
    id: "seb",
    pillar: "Social Connectivity Index",
    title: "Social Exchange Balance",
    description: "Measures the perceived equity and reciprocity in your close relationships.",
    questions: [
      "I feel that I generally give more to my relationships than I receive.",
      "When I do a favor for a friend, I trust they will return it when I need help.",
      "I often feel taken advantage of by people close to me.",
      "There is a fair balance of effort between me and my closest companions.",
      "I keep track of who owes whom in my relationships.",
      "I feel comfortable asking for help because I know I support others when they need it.",
      "My relationships drain my energy more often than they recharge it.",
      "I am satisfied with the level of emotional support I receive from my network.",
      "People tend to come to me only when they need something.",
      "I believe that generosity in relationships naturally balances out over time.",
    ],
  },
  ass: {
    id: "ass",
    pillar: "Social Connectivity Index",
    title: "Attachment Security",
    description: "Measures comfort with intimacy and trust in relationship stability.",
    questions: [
      "I find it relatively easy to get close to others.",
      "I often worry that my partners or close friends do not really care about me.",
      "I am comfortable depending on others for emotional support.",
      "I get uncomfortable when someone gets too close to me emotionally.",
      "I rarely worry about being abandoned by the people I care about.",
      "I find it difficult to allow myself to depend on others.",
      "I am confident that my close connections will be there for me in a crisis.",
      "I often feel that others are reluctant to get as close as I would like.",
      "I am comfortable having others depend on me.",
      "I prefer not to share my deepest thoughts and feelings with others.",
    ],
  },
  snv: {
    id: "snv",
    pillar: "Social Connectivity Index",
    title: "Social Network Vitality",
    description: "Measures the active engagement and health of your broader social graph.",
    questions: [
      "I have a diverse group of friends that I interact with regularly.",
      "I often feel isolated even when I am connected to people online.",
      "I actively participate in community or group activities.",
      "Most of my social interactions feel superficial.",
      "I feel a strong sense of belonging to a community.",
      "I find it difficult to maintain contact with friends over time.",
      "I regularly meet new people and expand my social network.",
      "I feel disconnected from the people in my immediate environment.",
      "My social circle exposes me to new ideas and perspectives.",
      "I rarely initiate social gatherings or reach out to friends first.",
    ],
  },
  jrda: {
    id: "jrda",
    pillar: "Work Engagement Index",
    title: "Job Resources-Demands Delta",
    description: "Measures the balance between workplace stressors and available support.",
    questions: [
      "I have the resources and tools I need to do my job effectively.",
      "The emotional demands of my work often feel overwhelming.",
      "I have a high degree of autonomy in how I complete my tasks.",
      "I consistently have too much work to do in the time available.",
      "I receive constructive and supportive feedback from my leadership.",
      "My job requires me to hide my true feelings frequently.",
      "I feel supported by my colleagues when facing difficult challenges.",
      "The mental pressure of my work negatively affects my personal life.",
      "I have opportunities for professional growth and learning.",
      "I feel physically exhausted at the end of most workdays.",
    ],
  },
  ocs: {
    id: "ocs",
    pillar: "Work Engagement Index",
    title: "Organizational Citizenship",
    description: "Measures willingness to go beyond formal job requirements to help others.",
    questions: [
      "I frequently help colleagues who have heavy workloads.",
      "I strictly stick to my job description and avoid extra tasks.",
      "I volunteer for assignments that are not required but help the organization.",
      "I complain about trivial things at work.",
      "I proactively share knowledge and expertise with my team.",
      "I focus only on my own performance, regardless of how the team does.",
      "I attend functions that are not required but help the organizational image.",
      "I tend to magnify small problems at work into larger issues.",
      "I take steps to prevent problems with other colleagues' work.",
      "I avoid getting involved in initiatives that don't directly benefit me.",
    ],
  },
  pcf: {
    id: "pcf",
    pillar: "Work Engagement Index",
    title: "Psychological Contract Fulfillment",
    description: "Measures the perceived fairness and met expectations in professional environments.",
    questions: [
      "My employer has fulfilled the promises made to me when I was hired.",
      "I feel that my organization has taken advantage of my dedication.",
      "I am compensated fairly for the value I bring to my work.",
      "The expectations placed on me change frequently without my agreement.",
      "I trust my leadership to make decisions with my best interests in mind.",
      "I often feel that the rules apply differently to different people at work.",
      "My organization supports my overall well-being, not just my output.",
      "I feel pressure to compromise my values to succeed in my organization.",
      "I see a clear and transparent path for advancement in my career.",
      "Communication from leadership is often misleading or incomplete.",
    ],
  },
  eq: {
    id: "eq",
    pillar: "Prosocial Disposition Index",
    title: "Empathy Quotient",
    description: "Measures both cognitive and affective empathy toward others.",
    questions: [
      "I can easily tell if someone else is interested or bored in a conversation.",
      "I find it difficult to know what to do in social situations.",
      "I am deeply moved by the misfortunes of others.",
      "I tend to focus on my own problems rather than the problems of others.",
      "I can usually intuitively understand how another person is feeling.",
      "I find it hard to see things from someone else's perspective.",
      "I naturally tune in to the emotional atmosphere of a room.",
      "People often tell me that I am insensitive, even though I don't mean to be.",
      "I enjoy caring for others and making them feel comfortable.",
      "I believe people should just toughen up instead of talking about their feelings.",
    ],
  },
  gup: {
    id: "gup",
    pillar: "Prosocial Disposition Index",
    title: "Generosity Under Pressure",
    description: "Measures the likelihood of prosocial behavior when resources or time are scarce.",
    questions: [
      "Even when I am stressed, I try to make time to help others.",
      "When my schedule is tight, I completely shut out other people's needs.",
      "I am willing to share my resources even if I don't have an abundance of them.",
      "Under pressure, it's every man for himself.",
      "I find that helping someone else actually relieves my own stress.",
      "I regret being generous when things get difficult for me later.",
      "I would inconvenience myself to prevent a friend from experiencing hardship.",
      "I believe generosity is a luxury for those who have extra time and money.",
      "I can remain patient with others even when I am under strict deadlines.",
      "Stress makes me highly irritable and dismissive of others.",
    ],
  },
  scs: {
    id: "scs",
    pillar: "Prosocial Disposition Index",
    title: "Social Context Sensitivity",
    description: "Measures the ability to adapt behavior to diverse social dynamics.",
    questions: [
      "I adapt my communication style based on who I am talking to.",
      "I often say things that people interpret as inappropriate for the setting.",
      "I can quickly figure out the unwritten rules of a new social group.",
      "I behave exactly the same way regardless of the cultural context.",
      "I am aware of how my actions impact the group dynamic as a whole.",
      "I struggle to understand why people react negatively to me sometimes.",
      "I adjust my behavior when I realize someone is uncomfortable.",
      "I believe people should just accept me as I am, regardless of the situation.",
      "I pay close attention to non-verbal cues in professional settings.",
      "I often dominate conversations without realizing it.",
    ],
  },
};

export const PILLARS = [
  {
    name: "Social Connectivity Index" as Pillar,
    weight: 0.45,
    keys: ["seb", "ass", "snv"] as TestId[],
  },
  {
    name: "Work Engagement Index" as Pillar,
    weight: 0.35,
    keys: ["jrda", "ocs", "pcf"] as TestId[],
  },
  {
    name: "Prosocial Disposition Index" as Pillar,
    weight: 0.2,
    keys: ["eq", "gup", "scs"] as TestId[],
  },
];
