race mode: 
    - refine the send mode races in the following ways:
        - fix bug where the sound for the first char is played
    - refine the button where we select send or copy mode for the test, lets make it so selecting one of those just highlights it and sets it as the mode that will be created when the user presses 'create race'

    - lol, am i supposed to use the 'realtime' schema?
    - is the WPM calculation correct? Is it special for CW?
    - allow the users to play again. incorporate some way for them to play again with different char set

training mode:
    - instead of displaying "fast answer" or "lightning quick" use some animations to indicate visually that they were fast
    - provide this for sending training too (currently only shows users in copy)

login improvements:
    - app should log the user right in when creating their user. currently signing up doesn't login until after the email has been verified

custom themes:
    - template out a specific color for "correct" and "incorrect" items. this way we can use theme specific colors for these critical ui elements but still use a different color for other ui elements. An example is in catppuccin. it would be nice to change buttons and menu from green to like pink or purple but we still want green and red for times when the user gets it right or wrong. or strikes in the checkpoint levels should still be red. etc.
    - catppuccin refinements:
        - use a pink color instead of the green accent but make sure things that should be green (like feedback on correct items is green?)
        - assets/social/latte_github.svg

icons throughout the ui:
    - copy
    - send
    - time
    - words
    - training
    - race - checkered flag pls
    - login/log out
    - settings

implement vercel analytics and performance tracking

play sounds for:
    - level complete
    - countdown including when the countdown begins
    - when race is finished

cleanup debug logging

my progress:
    - might want to rename to something more like 'user stats' and make it reachable from clicking on the username
    - show heatmap of user activity
    - show insightful charts about recognition of each character

implement an xp and leveling system
    - you get points for doing trainings, tests, races. (maybe just points for every char identified or sent?)
