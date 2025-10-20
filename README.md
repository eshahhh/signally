# signally
A browser tool inspired a bit by cluely that works to explain some concepts to you (useful for live explanations during meetings) 

# How to run

Go to [chrome://extensions](chrome://extensions), enable developer mode, click load unpacked and upload the `src` folder 
Navigate to ./server/.env and add your openAI api key
Run the following from the root of this repo
```bash
chmod +x start-server.sh
./start-server
```
This starts the server (for real time transcription using webRTC)
Navigate to any page on chrome which has audio playing and run the extension, make sure to add your openAI key for summarization (I would've used the same backend server but long story; [see next section]) and start recording

# Applications
The extension was meant to be my attempt at a cluely clone pretty much (bar the hidden from screen sharing part ofcourse) but I am not aware of hackclub's rules against dishonorable applications so I kinda pivoted away from it. 

Now it works as a general summarizer that also helps with intelligent follow up questions so you know what you are talking about, this works well in REVERSE of cluely where the interviewer might need some "signals" to understand what the interviewee might be yappng about and also get some follow up questions to ask; now they wont have to listen to the endless yap and play clash while the person talks, look up and ask the follow ups and then go back to clashing. But regardless it is very easy to switch to a cluely type app (only the LLM prompt needs to be changed)

The extension also works as a hidden meeting note-taker as the final summary can be exported and downloaded at the end for later referral to meeting notes

# Demo
Here's a demo of the fully working extension in its ~~final~~ submission-ready form:

![video](https://hc-cdn.hel1.your-objectstorage.com/s/v3/503a5fa7b854e6bf4ca0393ae97ab1d768a0db91_final.mp4)

Here's the summary of the video that got generated:
```plaintext
Signally Session Summary
========================

Generated: 20/10/2025, 06:44:05

Summary Points:
---------------

1. The speaker explains creating a trigger node that can run manually or on a schedule and illustrates connecting to a third-party app, using Telegram as an example.

2. The speaker discusses creating a trigger node that can run manually or on a schedule and demonstrates connecting to Telegram to trigger when a message is received, with the ability to route the data to AI or other apps.

3. The speaker describes creating a trigger node that can run manually or on a schedule, using Telegram as the connected app to trigger on receiving a message, and demonstrates routing the data to AI or other apps with conditional logic (e.g., emoji-based branching).

4. The discussion covers building a trigger node that connects to Telegram to fire on incoming messages, enabling data routing to AI or other apps and using conditional logic (such as emoji-based contains) to branch actions.
```

# Long story
I wanted to make the extension ready for use for everyone but: 
1. Hackclub.ai is down and I am paying for OpenAI from my own money to get this running right now
2. Because Hackclub.ai is down I had to do alot of last night changes which took way longer, this is not perfect and also why you have to input openAI API key twice (would be once if hackclub AI worked since it works without any API key). 
    - jbtw the two keys required are one for the whisper transcription and the second one is for the actual LLM


# Devlogs
Someone said I don't commit very often, so just in case, I've decided to add screenshots/short description of each milestone I've done so you can track my progress across commits and see that it is all actually meaningful milestones and not half broken code.
Check it out in [devlogs](./devlogs/)

# AI disclaimer
- This is my first extension so I had to use some AI help for the scaffolding and understanding how all the code should be structured
- Some of the overlay CSS was AI generated, the popout window is NOT
- Some UX improvement code from the final commit (better message passing) is also AI (essentially the same thing as print statements)
- Almost all console logs and error handling were AI generated (I cba with pretty print statements when Im trying to debug)