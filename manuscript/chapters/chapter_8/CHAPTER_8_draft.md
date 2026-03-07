# CHAPTER 8

# Assemble: Source Truth Controls Hallucinations

AI generates a plausible but wrong procedure.

The learner trusts it. They follow the steps. The outcome is incorrect. In a low-stakes environment, this is frustrating. In a high-stakes environment—safety, compliance, healthcare—this is catastrophic.

The problem is not that the AI is malicious. The problem is that the AI is **confident without being grounded**.

Large language models (LLMs) are trained on vast amounts of text from the internet. They learn patterns, correlations, and structures. They become very good at generating text that **sounds right**. But "sounds right" is not the same as **is right**.

Without grounding—without connection to authoritative, current, domain-specific source truth—AI will hallucinate. It will fill gaps with plausible fiction. It will blend outdated information with current information. It will confidently state things that are wrong.

This is why the third phase of ADAPT is **Assemble**: build the canonical knowledge base that grounds all content generation, personalization, and assessment.

This chapter is about what source truth is, why it matters, how to build it, and how to maintain it over time.

## What Is a Hallucination?

A **hallucination** is when an AI generates content that is plausible but factually incorrect, unsupported by source data, or inconsistent with authoritative references.

Hallucinations are not random. They are **systematic failures** that occur when the model:

1. **Lacks access to the correct information** (it was not in the training data)
2. **Has outdated information** (the training data is old)
3. **Conflates similar but distinct concepts** (pattern matching without understanding)
4. **Fills gaps with plausible guesses** (the model is trained to always generate an answer, even when it should abstain)

Research shows that hallucinations involve "content that lacks factual grounding."[^1] One hallucination can lead to another—creating **cascading failures** where the first error compounds into subsequent errors.[^1]

This is the danger. Not just that the AI is wrong once, but that the error propagates.

## Why Grounding Is Not Optional

**Grounding** is the process of connecting large language models to **real-world data** to prevent hallucinations and ensure more reliable and relevant outputs.[^2]

Without grounding, LLMs are only able to use data they were trained on to produce answers.[^3] That training data may be:

- **Outdated:** Procedures change, regulations update, standards evolve
- **Incomplete:** Domain-specific knowledge is often not well-represented in public training data
- **Incorrect:** The internet contains misinformation, and models learn from it

For domain-specific or time-sensitive information—like training content, procedures, regulations, or safety protocols—grounding is not optional. It is **required**.

Research on retrieval-augmented generation (RAG) shows that grounding has proven effective in improving answer accuracy by retrieving relevant information and then generating responses grounded in that data.[^4] In high-stakes domains like construction safety, RAG systems **significantly improve accuracy** compared to ungrounded models.[^5]

The evidence is clear: **grounded AI is more accurate, more reliable, and more trustworthy than ungrounded AI**.

## What Is Source Truth?

**Source truth** is the canonical knowledge base that defines what is correct, current, and authoritative for a given domain.

It includes:

- **Standards and regulations:** Official documents that define requirements
- **Approved procedures:** Step-by-step instructions that have been validated
- **Authoritative references:** Textbooks, manuals, and documentation from trusted sources
- **Version history:** Change logs that document what changed and when
- **Hierarchy of authority:** Rules for resolving conflicts when sources disagree

Source truth is not just "content." It is **structured, versioned, and governed** content that serves as the control system for all downstream generation.

## The SourcePack: What Must Exist Before Content Generation

Before you generate a single lesson, quiz, or explanation, you must assemble a **SourcePack**—a structured collection of source truth for the competency you are teaching.

A minimum viable SourcePack includes:

### 1. Canonical References

**What it is:** The authoritative documents that define what is correct.

**Examples:**
- Industry standards (ISO, ANSI, IEEE)
- Regulatory requirements (OSHA, FDA, EPA)
- Manufacturer documentation (equipment manuals, technical specs)
- Textbooks and academic references
- Internal policies and procedures

**Why it matters:** If you do not define what is authoritative, the AI will guess. And guesses are not defensible.

**How to structure it:**
- Document title and version
- Publication date or revision date
- Source URL or file path
- Relevant sections or excerpts
- Authority level (primary, secondary, supplementary)

---

### 2. Version Control

**What it is:** A system for tracking changes to source truth over time.

**Why it matters:** Standards change. Procedures update. Regulations evolve. If your training content is based on an outdated version of the source, it is wrong—even if it was correct when you created it.

**How to structure it:**
- Version number or date
- Change log (what changed and why)
- Effective date (when the new version becomes authoritative)
- Deprecation schedule (when the old version is no longer valid)

**Example:**

| Version | Effective Date | Changes | Status |
|---------|----------------|---------|--------|
| 2.1 | 2026-01-01 | Updated safety protocols per OSHA revision | Current |
| 2.0 | 2025-06-01 | Added new equipment procedures | Deprecated |
| 1.5 | 2024-12-01 | Initial release | Deprecated |

When version 2.1 becomes effective, all training content derived from version 2.0 must be updated or flagged as outdated.

---

### 3. Hierarchy of Authority

**What it is:** Rules for resolving conflicts when sources disagree.

**Why it matters:** Different sources may provide conflicting information. The system must know which source overrides.

**How to structure it:**

**Priority Order (Highest to Lowest):**
1. **Regulatory requirements** (law and compliance)
2. **Internal policies** (organizational standards)
3. **Manufacturer specifications** (equipment-specific)
4. **Industry best practices** (general guidance)
5. **Academic references** (theoretical background)

**Example Conflict:**

- **Regulatory requirement:** "Safety check must be performed every 24 hours"
- **Manufacturer specification:** "Safety check recommended every 48 hours"

**Resolution:** Regulatory requirement overrides manufacturer specification. The training content must reflect the 24-hour requirement.

---

### 4. Scope and Boundaries

**What it is:** A clear definition of what the SourcePack covers and what it does not cover.

**Why it matters:** AI will attempt to answer questions even when the source truth does not provide an answer. Defining boundaries prevents the AI from generating content outside its domain of authority.

**How to structure it:**
- **In scope:** Topics, procedures, and competencies covered by this SourcePack
- **Out of scope:** Topics that require different sources or expert consultation
- **Escalation triggers:** Situations where the AI should refuse to answer and route to a human

**Example:**

- **In scope:** Standard operating procedures for equipment startup and shutdown
- **Out of scope:** Emergency procedures for equipment failure (requires separate SourcePack)
- **Escalation trigger:** If the learner asks about a failure mode not covered in the SOP, escalate to supervisor

---

### 5. Update Triggers

**What it is:** Conditions that require the SourcePack to be reviewed and updated.

**Why it matters:** Source truth decays. If you do not define when to update, the SourcePack will become obsolete.

**How to structure it:**

**Automatic Triggers:**
- Regulatory change (new OSHA standard published)
- Equipment update (new model or firmware version)
- Incident or near-miss (procedure failed in the field)
- Scheduled review (annual or biannual audit)

**Manual Triggers:**
- Subject matter expert identifies error or gap
- Learner feedback reveals confusion or ambiguity
- Audit reveals inconsistency between training and practice

---

## Retrieval-Augmented Generation (RAG): How Grounding Works

The most effective way to ground AI is through **Retrieval-Augmented Generation (RAG)**—a technique where the AI retrieves relevant documents from the SourcePack before generating a response.

Here is how it works:

### Step 1: Learner Asks a Question

**Example:** "What is the procedure for equipment startup?"

### Step 2: System Retrieves Relevant Documents

The system searches the SourcePack for documents related to "equipment startup." It retrieves:

- Section 4.2 of the Standard Operating Procedure (SOP)
- Safety checklist from the equipment manual
- Regulatory requirement for pre-startup inspection

### Step 3: AI Generates Response Grounded in Retrieved Documents

The AI uses the retrieved documents as context and generates a response that is **grounded in source truth**.

**Generated Response:**

"The equipment startup procedure consists of three steps:

1. **Pre-startup inspection** (per OSHA 1910.147): Verify all guards are in place, emergency stop is functional, and area is clear.
2. **System initialization** (per SOP Section 4.2): Power on the control panel, run diagnostic check, and verify all indicators are green.
3. **Safety checklist** (per equipment manual): Complete the startup checklist and obtain supervisor signoff before operation.

**Source:** SOP v2.1, Section 4.2; Equipment Manual v3.0, Page 12; OSHA 1910.147"

The response is accurate, current, and **auditable**—every claim is traceable to a source document.

---

## The Power of RAG: Research Evidence

Research on RAG is extensive and conclusive:

- **Comprehensive review (235 citations):** RAG has proven effective in improving answer accuracy by retrieving relevant information and generating responses grounded in that data.[^4]

- **Construction safety study (35 citations):** RAG systems using vector data to enhance information retrieval **significantly improve accuracy** in high-stakes domains.[^5]

- **Practitioner insight:** "The success of RAG systems hinges on the synergy between a powerful language model and an effective retrieval system."[^6]

- **AWS research:** With automated reasoning checks and contextual grounding, systems can achieve **up to 99% verification accuracy**.[^7]

The evidence is overwhelming: **RAG works**. But it only works if the SourcePack is high-quality, current, and well-structured.

---

## Guardrails: Preventing Hallucinations Before They Happen

Even with RAG, hallucinations can occur if the retrieved context is insufficient or ambiguous. That is why grounding systems must include **guardrails**—validation checks that prevent hallucinations before they reach the learner.

### 1. Contextual Grounding Checks

**What it is:** Verify that the generated response is supported by the retrieved documents.

**How it works:** The system compares the generated response to the source documents and flags any claims that are not grounded.

**Example:**

- **Generated claim:** "The equipment must be inspected every 48 hours."
- **Source document:** "The equipment must be inspected every 24 hours."
- **Guardrail action:** Flag as hallucination, regenerate response.

Research shows that modern guardrails that support contextual grounding can significantly reduce hallucinations.[^8]

---

### 2. Confidence Thresholds

**What it is:** Require the AI to abstain from answering when confidence is low.

**How it works:** If the retrieval system does not find sufficient context, the AI should say "I don't know" instead of guessing.

**Example:**

- **Learner question:** "What is the procedure for handling a Type 7 failure?"
- **Retrieval result:** No documents found for "Type 7 failure"
- **AI response:** "I don't have information on Type 7 failures in the current SourcePack. Please consult your supervisor or refer to the emergency procedures manual."

Research shows that while RAG improves performance, it can paradoxically reduce the model's ability to abstain when it should.[^9] Systems must be designed to detect insufficient context and refuse to answer.

---

### 3. Source Citation Requirements

**What it is:** Require every generated response to include citations to source documents.

**How it works:** If the AI cannot cite a source, it cannot make the claim.

**Example:**

- **Acceptable:** "The safety check must be performed every 24 hours (OSHA 1910.147)."
- **Unacceptable:** "The safety check should be performed regularly."

Source citations make the response **auditable**. If a learner or auditor questions the accuracy, they can trace the claim back to the source document.

---

## Change Management: When Source Truth Updates

Source truth is not static. Standards change. Procedures update. Regulations evolve.

When source truth updates, all derived content must update. This is **change management**—the process of propagating updates from source truth to training content.

### The Update Workflow

**Step 1: Detect the Change**
- Regulatory agency publishes new standard
- Equipment manufacturer releases firmware update
- Internal policy is revised

**Step 2: Update the SourcePack**
- Add new version to SourcePack
- Update version control log
- Mark old version as deprecated

**Step 3: Identify Affected Content**
- Which modules, lessons, or assessments reference the old version?
- Which learners are currently in progress on outdated content?

**Step 4: Regenerate or Flag Content**
- **Option A:** Automatically regenerate content from the new SourcePack
- **Option B:** Flag content as "outdated, pending review" and route to subject matter expert

**Step 5: Notify Learners**
- Learners who completed training on the old version may need re-verification
- Learners in progress are routed to updated content

**Step 6: Audit and Verify**
- Confirm that all content reflects the new source truth
- Test a sample of generated content to verify accuracy

---

## The Moment You Realize Source Truth Is the Control System

Most organizations treat content as the product. They spend months creating videos, documents, and quizzes. Then the source truth changes, and all that content is obsolete.

Adaptive Education™ flips this model.

**Source truth is the product. Content is generated from source truth.**

When source truth updates, content updates. When source truth is versioned, content is versioned. When source truth is auditable, content is auditable.

This is the shift from **content library** to **competence factory**.

Content libraries decay. Competence factories adapt.

---

## Failure Modes

- **No canonical source defined** — AI guesses, hallucinations occur
- **Outdated source truth** — training content is wrong even if it was correct when created
- **No hierarchy of authority** — system cannot resolve conflicts between sources
- **No version control** — cannot trace when content became obsolete
- **No update triggers** — SourcePack decays silently
- **No guardrails** — hallucinations reach learners before being caught

## Operator Playbook: Build a SourcePack for One Competency

**Step 1: Pick one competency you want to teach**

**Step 2: Identify canonical references**
- What are the authoritative sources?
- List at least 3 references (standards, procedures, manuals)

**Step 3: Document version control**
- What version is each reference?
- When was it last updated?
- When is the next review scheduled?

**Step 4: Define hierarchy of authority**
- If sources conflict, which one overrides?
- Rank sources from highest to lowest authority

**Step 5: Define scope and boundaries**
- What topics are in scope?
- What topics are out of scope?
- What triggers escalation to a human?

**Step 6: Define update triggers**
- What conditions require the SourcePack to be updated?
- Who is responsible for monitoring changes?

**Step 7: Test it**
- Generate 3 explanations or quiz questions from the SourcePack
- Are they accurate?
- Are they grounded in source truth?
- Can you trace every claim to a source document?

---

## Proof Task

Pick one lesson or module you currently teach or take.

**Step 1: Audit the source truth**
- What sources does the content reference?
- Are they current?
- Are they authoritative?

**Step 2: Identify gaps**
- Are there claims in the content that are not grounded in source truth?
- Are there sources that conflict?
- Is there a hierarchy of authority?

**Step 3: Build a SourcePack**
- List 3-5 canonical references
- Document version control
- Define hierarchy of authority
- Define scope and boundaries
- Define update triggers

**Step 4: Test grounding**
- Generate 3 new explanations or quiz questions from the SourcePack
- Compare them to the existing content
- Are they more accurate?
- Are they more defensible?

**Step 5: Document what you learned**
- What was missing from the original content?
- What would it take to maintain the SourcePack over time?
- How would you propagate updates when source truth changes?

---

## Pull Quote

> "Source truth is the control system. Without it, AI will hallucinate. With it, AI becomes a reliable production system for verified competence."

---

## References

[^1]: Liu, Z., et al. (2024). "Comprehensive Evaluation of AI Hallucination and Novel UV-Oriented Framework toward Safe and Trustworthy AI." IEEE Transactions on Universal Village.

[^2]: K2View Blog. "Grounding AI reduces hallucinations and increases reliability." https://www.k2view.com/blog/grounding-ai/

[^3]: Moveworks (October 29, 2024). "AI Grounding: How Agentic RAG Helps Limit Hallucinations." https://www.moveworks.com/us/en/resources/blog/improved-ai-grounding-with-agentic-rag

[^4]: Gupta, S., et al. (2024). "A Comprehensive Review of Retrieval-Augmented Generation." arXiv. [Cited by 235 papers] https://arxiv.org/pdf/2410.12837

[^5]: Uhm, M., et al. (2025). "Effectiveness of retrieval augmented generation-based systems." ScienceDirect. [Cited by 35 papers]

[^6]: Medium. "What I've Learned in 10 Months of Doing RAG (Retrieval-Augmented Generation)." https://medium.com/@ceo_44783/what-ive-learned-in-10-months-of-doing-rag-retrieval-augmented-generation-0520563ad256

[^7]: AWS Blog (August 6, 2025). "Minimize AI hallucinations and deliver up to 99% verification accuracy with automated reasoning checks." https://aws.amazon.com/blogs/aws/minimize-ai-hallucinations-and-deliver-up-to-99-verification-accuracy-with-automated-reasoning-checks-now-available/

[^8]: Red Hat Blog (September 25, 2024). "When LLMs day dream: Hallucinations and how to prevent them." https://www.redhat.com/en/blog/when-llms-day-dream-hallucinations-how-prevent-them

[^9]: Google Research (May 14, 2025). "Deeper insights into retrieval augmented generation: The role of sufficient context." https://research.google/blog/deeper-insights-into-retrieval-augmented-generation-the-role-of-sufficient-context/

---

**Word Count: ~3,500 words**
