# CHAPTER 9: Assemble: The War Against Hallucination

Dr. Aris Thorne, a brilliant but overworked third-year resident, stood at the bedside of a seven-year-old boy, Leo, who was struggling to breathe. Leo had a severe bacterial infection, and the standard antibiotic wasn't working. Aris knew there was a powerful second-line drug, but it carried a significant risk of kidney damage, especially in children. He remembered a lecture from medical school about a new protocol for this exact situation—a specific dosing adjustment based on the child's weight and kidney function that dramatically reduced the risk.

He pulled out his phone and accessed the hospital's digital learning library, a vast repository of training modules and clinical guidelines. He quickly found the module on pediatric sepsis. It was professional, polished, and featured a video of a respected senior physician. Aris found the section on the second-line antibiotic. It described a straightforward dosing calculation. It seemed simpler than he remembered from the lecture, but the module was recent, and the source was trusted. Confident, he entered the dosage into the electronic health record and administered the drug.

Within 24 hours, Leo's breathing had stabilized, but his urine output had plummeted. His kidneys were failing. A frantic consult with the chief of nephrology revealed the horrifying truth. The dosing protocol Aris had followed was three years old. A year ago, a major study had been published showing that the old protocol was dangerous for children with even mild dehydration, a fact not mentioned in the training module. The new, safer protocol—the one Aris vaguely remembered from his lecture—was the new standard of care. But the hospital's training library had never been updated.

Aris had followed the training perfectly. He had trusted the system. And in doing so, he had caused a catastrophic, life-altering injury. The AI that powered the library's search function had not been malicious. It had simply served up the most relevant document it could find, with no concept of whether that document was current, correct, or safe. It had hallucinated, confidently presenting outdated information as truth. And a seven-year-old boy paid the price.

This is the terrifying reality of ungrounded knowledge. In a world where information changes at an accelerating pace, a static library of content is not just a suboptimal tool; it is a ticking time bomb. The most dangerous information is not that which is obviously wrong, but that which is plausible, confident, and out of date. The antagonist is not ignorance; it is the hallucination—the confident, articulate, and utterly baseless assertion that leads well-intentioned people to make disastrous mistakes.

## The SourcePack: A Control System for Truth

How do you build a system that can be trusted in a high-stakes environment? You don't just add more content. You build a control system. You build a **SourcePack**.

The SourcePack is the third and most critical phase of the ADAPT framework. It is the discipline of **assembling and maintaining a canonical, version-controlled, and auditable body of source truth** that governs every piece of content the system generates.

It is the weapon you use to fight the war against hallucination. It is the difference between a system that generates plausible fictions and a system that can be trusted with a child's life.

A SourcePack is not just a folder of documents. It is a structured, governed knowledge base with four essential components:

1.  **Canonical References:** This is the collection of authoritative documents that define what is correct. For the pediatric sepsis module, this would include the latest guidelines from the Infectious Diseases Society of America, the FDA's prescribing information for the antibiotic, and the hospital's own clinical protocols. These are not just links; they are specific, versioned documents.

2.  **Hierarchy of Authority:** Sources often conflict. The FDA label might differ from a recent journal article. The SourcePack defines a clear hierarchy of authority. For example: *Regulatory guidance > Internal hospital policy > Peer-reviewed medical society guidelines > Manufacturer information.* The system must know which source wins in a conflict.

3.  **Version Control:** Every document in the SourcePack has a version number, a publication date, and a change log. When a new study is published or a guideline is updated, the old document is not deleted; it is deprecated, and the new one becomes the active source. This creates an auditable trail. If an incident occurs, you can know with certainty which version of which document was used to generate the training that a learner received on a specific date.

4.  **Update Triggers:** The SourcePack is a living system. It has defined triggers for review and update. These can be time-based (e.g., an annual review of all clinical guidelines) or event-based (e.g., an FDA drug safety communication, a new black-box warning, a published clinical trial). When a trigger fires, the system automatically flags the relevant content for review by a human subject matter expert.

## Retrieval-Augmented Generation (RAG): The Engine of Grounding

Once the SourcePack exists, it becomes the foundation for a powerful AI technique called **Retrieval-Augmented Generation (RAG)**. RAG is how you force the AI to ground its responses in your curated reality, not its own vast but unreliable training data.

When a learner like Aris asks a question—"What is the pediatric dose for this antibiotic?"—the system does not immediately ask the LLM to answer. Instead, it performs a two-step process:

1.  **Retrieve:** The system first searches the **SourcePack** for the most relevant, up-to-date documents related to the query. It finds the latest clinical guideline (Version 3.1, published two months ago) and the FDA's most recent prescribing information.

2.  **Generate:** It then passes those specific documents to the LLM with a new prompt: "**Using only the information in the attached documents**, answer the user's question about the pediatric dose for this antibiotic."

The LLM is now operating in a closed loop. It is not being asked to recall information from its training; it is being asked to synthesize and explain the information provided in the trusted, version-controlled documents. The result is an answer that is not just plausible, but correct, current, and—most importantly—**auditable**. The system can even provide a direct citation, linking its answer back to the specific section of the source document it used.

This is the difference between a search engine and a truth engine. A search engine gives you a list of ten blue links, some of which may be outdated, irrelevant, or flat-out wrong. A truth engine gives you a single, synthesized answer, grounded in a body of knowledge that you control.

In the case of Dr. Thorne and his patient, a system built on this architecture would have prevented the tragedy. The outdated training module would have been automatically flagged for review the day the new clinical guidelines were published. The RAG system would have retrieved the new, safer protocol, and the AI-generated explanation would have guided Aris to the correct, life-saving dose.

Building a SourcePack is not easy. It requires discipline, governance, and a commitment to maintenance. But in any domain where the cost of being wrong is high, it is not optional. It is the only way to build a learning system that deserves to which you can safely entrust your business, your reputation, and the well-being of those you serve.
