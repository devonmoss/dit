when copy training:
    - points are not determined based on speed
    - no penalty for incorrect guess
    - on test summary page:
        - hitting enter doesn't move to next lesson (clicking button does)
        - hitting tab doesn't restart test (clicking restart test does)

when sending training:
- the UI is distracting
    - just as was happening with copy training the level is not ending once all chars are mastered but instead requires one extra correct answer.
    - points are not determined based on speed
    - no penalty for incorrect guess
    - it has lots of unwanted movement when showing success/failure
    - needs styling improvements 
        - sections that show morse and english char have big wide white backgrounds
        - Send the character: T ==> Correct! You sent: T should just show the letter T significantly larger so it is the main visual focus.
        - the letter to be sent should disappear when correctly identified so there is a distinct indication that a new letter has appeared. It is very confusing if the same character is shown twice in a row at the moment because there is no idication that we are on a different letter.
    - needs to keep track of how long it took to key in the char and store it in the db after the test is complete
    - sending training level summary should match the copy training summary

placeholders for other modes:
    - time: Coming soon! Complete as many characters as possible in a set amount of time.
    - words: Coming soon! Identify or send words of various sizes. 

race mode: 
    - implement send mode
    - is the WPM calculation correct? Is it special for CW?
    - allow the users to play again. incorporate some way for them to play again with different char set

login should require username creation.
    - the app should not use any tables that have the email address (except a user settings page)
    - we always use either their username (if logged in) or an anonymous name (maybe generate a fun one at some point)
    - hitting the login button should bring you to a dedicated /login page

general app navigation
    - clicking on training when on a race screen should bring you either to /training or /
    - clicking words should bring you to /words
    - clicking time should bring you to /time
    - clicking on race or navigating back to /race should bring up the race creation page even if you were already in a race


my progress:
    - might want to rename to something more like 'user stats' and make it reachable from clicking on the username
    - show heatmap of user activity
    - show insightful charts about recognition of each character

implement an xp and leveling system
    - you get points for doing trainings, tests, races. (maybe just points for every char identified or sent?)



