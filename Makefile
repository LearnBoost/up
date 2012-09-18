
TESTS = test/up.test.js test/sticky.test.js
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--slow 1000ms \
		--bail \
		--growl \
		$(TESTS)

.PHONY: test

