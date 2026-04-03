-- 修改 words 唯一约束：去除 source，同一用户下同一单词只能存在一条
ALTER TABLE words DROP CONSTRAINT unique_word_per_user;
ALTER TABLE words ADD CONSTRAINT unique_word_per_user UNIQUE (word, user_id);
