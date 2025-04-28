race mode: 
    - refine the send mode races in the following ways:
        - fix bug where the sound for the first char is played

    - lol, am i supposed to use the 'realtime' schema?
    - is the WPM calculation correct? Is it special for CW?
    - allow the users to play again. incorporate some way for them to play again with different char set

xp leveling improvements:
    - remove ui from level summary details and just show animation in navbar by level indicator showing +240 or however many points they got. That would be much cleaner
    - make the level summary ui look the way it did before
    - cleanup the race completion details. it is showing a really ugly total for their xp usage. again we want a nice clean subtle indicator that xp was gained.

Auth panel updates:
    - it should only show the username in the top right when logged in
    - to the right of the username should be an icon to logout. clicking it brings up a little thing asking if they want to logout
    - clicking the username brings them to their user stats page (currently called my progress)

training mode:
    - instead of displaying "fast answer" or "lightning quick" use some animations to indicate visually that they were fast
    - provide this for sending training too (currently only shows users in copy)

login improvements:
    - app should log the user right in when creating their user. currently signing up doesn't login until after the email has been verified

custom themes:
    - research if there is like a standard for creating templates and if there is implement vars for each of those colors.
    - ideally we can use opacity and drop shadows and stuff to avoid needing to find similar but slightly darker colors.
    - move theme switcher to its own spot
    - add several more popular themes

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
