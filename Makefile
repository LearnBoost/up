
TESTS = test/up.js test/sticky.js
REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--slow 1000ms \
		--bail \
		--growl \
		$(TESTS)

.PHONY: test

