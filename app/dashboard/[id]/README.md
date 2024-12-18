logic

messages types - message, function_call, function_call_output

if it is a message then 
1. check role for user or assistant
2. if it is user then there si something like content = [ { "type": "input_text", "text": "Hello!" } ]
3. if it is assistant then there will be something like content = [
   {
   "type": "audio",
   "transcript": "Hello! How can I help you today?"
   }
   ]
4. if it function_call then there will be somethin like arguments : "{\"query\":\"Hello!\"}"
5. if it is function_call_output there will be something like output : "{\"success\":true,\"answer\":\"Information related to this question is not found.\"}"

so what you need to do is store these info in database..

so we will add each message to database..

if it a user message content = message, type/role = user
if it a assitant messeage content = transcript  type/role = assistant
if it a function_call type/role = system function_call = name function_call_text = arguments
if it a  function_call_output type/role = system function_call_text = output 


