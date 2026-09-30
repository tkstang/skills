# Team announcement: moving to trunk-based development

Hi everyone,

I wanted to let you all know that after a lot of deliberation and many conversations with various stakeholders across the engineering organization, we have collectively decided that we are going to be making a fairly significant change to the way that we do our day-to-day development work going forward, which is that we will be moving away from our current long-lived feature branch model and adopting what is commonly referred to in the industry as a trunk-based development workflow.

The reason that we are doing this is because we have noticed that our feature branches tend to live for a very long time, sometimes weeks, and this causes a lot of really painful merge conflicts when they finally do get merged back into the main branch, and it also means that code sits unreviewed and unintegrated for long periods, which is not great.

Under the new model, everyone will commit small changes directly to main behind feature flags, at least once a day, and we will rely on our CI suite and the feature flag system to keep things safe. There will be a transition period of about two weeks where we will run both models in parallel so that people can get comfortable.

Please let me know if you have any questions or concerns, and I am very happy to chat one-on-one with anyone who wants to talk through what this means for their current work.

Thanks,
The Platform Team
